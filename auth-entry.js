/* Branded sign-in flow. Uses the same Supabase session as the collection app. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('form'), status = $('status');
  let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';
  let session = null, busy = false, client;
  const redirect = new URL('./anmelden.html', location.href).href;
  function api() {
    if (!client) {
      const config = window.LEGO_SUPABASE;
      if (!window.supabase || !config) throw Error('Anmeldedienst nicht geladen. Bitte die Seite neu laden.');
      client = window.supabase.createClient(config.url, config.publishableKey);
    }
    return client;
  }
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }
  function render() {
    $('heading').textContent = mode === 'signup' ? 'Deine Sammlung beginnt hier.' : mode === 'reset' ? 'Passwort zurücksetzen' : mode === 'password' ? 'Neues Passwort festlegen' : 'Willkommen zurück.';
    $('intro').textContent = mode === 'signup' ? 'Erstelle dein Konto für den Brick City Manager. Bis zu 20 Sets kostenlos verwalten.' : mode === 'reset' ? 'Wir senden dir einen Link, mit dem du ein neues Passwort festlegen kannst.' : mode === 'password' ? 'Vergib ein neues Passwort für dein Brick City Manager Konto.' : 'Melde dich an und öffne deine persönliche Sammlung.';
    $('login').textContent = mode === 'signup' ? 'Kostenloses Konto erstellen' : mode === 'reset' ? 'Link anfordern' : mode === 'password' ? 'Passwort speichern' : 'Anmelden';
    $('passwordRow').hidden = mode === 'reset';
    $('passwordHint').hidden = mode !== 'signup' && mode !== 'password';
    $('emailRow').hidden = mode === 'password';
    $('password').required = mode !== 'reset';
    $('email').required = mode !== 'password';
    $('password').autocomplete = mode === 'signup' || mode === 'password' ? 'new-password' : 'current-password';
    $('register').textContent = mode === 'login' ? 'Noch kein Konto? Kostenlos registrieren' : 'Zurück zur Anmeldung';
    $('forgot').hidden = mode !== 'login';
    $('open').hidden = !session || mode === 'password';
    $('switch').hidden = !session || mode === 'password';
    $('sessionPanel').hidden = !session;
    $('sessionInfo').textContent = session ? 'Angemeldet als ' + (session.user?.email || 'dein Konto') : '';
  }
  function friendly(error) {
    const text = error?.message || String(error);
    if (/invalid login credentials/i.test(text)) return 'E-Mail-Adresse oder Passwort stimmt nicht. Bitte prüfe deine Eingabe.';
    if (/email not confirmed/i.test(text)) {
      $('resend').hidden = false;
      return 'Bitte bestätige zuerst deine E-Mail-Adresse. Du kannst den Bestätigungslink erneut anfordern.';
    }
    if (/rate limit|too many|after \d+ seconds/i.test(text)) return 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.';
    if (/fetch|network|load failed/i.test(text)) return 'Die Verbindung zum Anmeldedienst ist unterbrochen. Bitte prüfe deine Internetverbindung und versuche es erneut.';
    return text;
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    document.querySelectorAll('button').forEach(button => button.disabled = true);
    try { await action(); } catch (error) { message(friendly(error), true); }
    finally { busy = false; document.querySelectorAll('button').forEach(button => button.disabled = false); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    run(async () => {
      const email = $('email').value.trim(), password = $('password').value;
      message('Bitte einen Moment …');
      if (mode === 'signup') {
        const { data, error } = await api().auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        session = data?.session || null;
        render();
        $('resend').hidden = !!session;
        // Do not overwrite this with a generic "Bitte anmelden" session message.
        message(session ? 'Konto erstellt. Du kannst deine Sammlung öffnen.' : 'Bitte prüfe dein E-Mail-Postfach und den Spam-Ordner. Falls die Registrierung möglich war, erhältst du einen Bestätigungslink für den Brick City Manager. Öffne den Link und melde dich anschließend an.');
        $('password').value = '';
      } else if (mode === 'reset') {
        const { error } = await api().auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        message('Falls ein Konto zu dieser E-Mail-Adresse besteht, erhältst du einen Link zum Zurücksetzen. Bitte prüfe auch den Spam-Ordner.');
      } else if (mode === 'password') {
        const { error } = await api().auth.updateUser({ password });
        if (error) throw error;
        mode = 'login'; $('password').value = ''; render(); message('Passwort gespeichert. Du kannst deine Sammlung öffnen.');
      } else {
        const { data, error } = await api().auth.signInWithPassword({ email, password });
        if (error) throw error;
        session = data?.session || null;
        if (!session) throw Error('Keine gültige Sitzung erhalten. Bitte melde dich erneut an.');
        await openCollection();
      }
    });
  });
  $('register').addEventListener('click', () => { mode = mode === 'login' ? 'signup' : 'login'; $('resend').hidden = true; render(); message(''); });
  $('forgot').addEventListener('click', () => { mode = 'reset'; render(); message(''); });
  $('resend').addEventListener('click', () => {
    if (!$('email').reportValidity()) return;
    run(async () => {
      const { error } = await api().auth.resend({ type: 'signup', email: $('email').value.trim(), options: { emailRedirectTo: redirect } });
      if (error) throw error;
      message('Falls dein Konto noch nicht bestätigt ist, wurde der Bestätigungslink erneut angefordert. Bitte prüfe dein Postfach und den Spam-Ordner.');
    });
  });
  $('switch').addEventListener('click', () => run(async () => {
    const { error } = await api().auth.signOut(); if (error) throw error;
    session = null; mode = 'login'; $('email').value = ''; $('password').value = ''; render(); message('Du bist abgemeldet.');
  }));
  async function openCollection() {
    const { data, error } = await api().auth.getUser();
    if (error || !data?.user) { session = null; render(); message('Die Sitzung ist abgelaufen. Bitte melde dich erneut an.', true); return; }
    sessionStorage.setItem('brick-login-entry-5096', 'allow');
    message('Anmeldung erfolgreich. Deine Sammlung wird geöffnet …');
    location.assign('./index.html?v=50.99');
  }
  $('open').addEventListener('click', () => run(openCollection));
  render();
  (async () => {
    try {
      api().auth.onAuthStateChange((event, current) => {
        // No await/Auth API calls inside the Supabase auth lock.
        setTimeout(() => {
          session = current;
          if (event === 'PASSWORD_RECOVERY') mode = 'password';
          render();
        }, 0);
      });
      const { data, error } = await api().auth.getSession();
      if (error) throw error;
      session = data?.session || null;
      if (new URLSearchParams(location.hash.slice(1)).has('error_description')) message('Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.', true);
      render();
    } catch (error) { message(friendly(error), true); }
  })();
})();
