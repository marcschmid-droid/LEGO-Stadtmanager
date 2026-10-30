/* Presentation hooks only. No collection, account, storage or cloud writes. */
(function(){
  'use strict';
  function accountIcon(){
    const button=document.getElementById('userTop');
    if(!button||button.textContent.trim()!=='👤')return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','bcmIcon');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('aria-hidden','true');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href','./assets/ui-icons.svg?v=graphic-1#user');svg.append(use);
    button.replaceChildren(svg);
  }
  function navigation(){
    document.querySelectorAll('.tabsGroupedV550 .tab[data-tab]').forEach(button=>{
      if(button.classList.contains('active'))button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }
  if(typeof updateAccountBadgeV3==='function'){
    const previous=updateAccountBadgeV3;
    updateAccountBadgeV3=function(...args){const result=previous.apply(this,args);accountIcon();return result};
  }
  if(typeof switchTab==='function'){
    const previous=switchTab;
    switchTab=function(...args){const result=previous.apply(this,args);navigation();return result};
  }
  function placeUndo(){
    const button=document.getElementById('undoV546');
    const toolbar=document.querySelector('#collection > .toolbar');
    if(button&&toolbar&&button.parentElement!==toolbar)toolbar.append(button);
  }
  if(typeof renderUndoV546==='function'){
    const previous=renderUndoV546;
    renderUndoV546=function(...args){const result=previous.apply(this,args);placeUndo();return result};
  }
  function actionIcon(id,icon,label,accessibleLabel){
    const button=document.getElementById(id);
    if(!button||button.dataset.visualAction)return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','bcmIcon');svg.setAttribute('width','20');svg.setAttribute('height','20');svg.setAttribute('aria-hidden','true');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href','./assets/ui-icons.svg?v=graphic-1#'+icon);svg.append(use);
    const caption=document.createElement('span');caption.textContent=label;
    button.replaceChildren(svg,caption);button.dataset.visualAction='true';
    button.setAttribute('aria-label',accessibleLabel);
  }
  function toolbarIcons(){
    actionIcon('showcaseShare','share','Teilen','Sammlung teilen');actionIcon('undoV546','undo','Rückgängig','Letzte Änderung rückgängig machen');
    const share=document.getElementById('showcaseShare'),undo=document.getElementById('undoV546');
    if(share&&undo&&share.parentElement===undo.parentElement&&undo.previousElementSibling!==share)share.parentElement.append(undo);
  }
  function init(){
    accountIcon();navigation();placeUndo();toolbarIcons();
    const toolbar=document.querySelector('#collection > .toolbar');
    if(toolbar)new MutationObserver(toolbarIcons).observe(toolbar,{childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
