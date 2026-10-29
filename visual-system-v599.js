/* Presentation hooks only. No collection, account, storage or cloud writes. */
(function(){
  'use strict';
  function accountIcon(){
    const button=document.getElementById('userTop');
    if(!button||button.textContent.trim()!=='👤')return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','bcmIcon');svg.setAttribute('aria-hidden','true');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href','./assets/ui-icons.svg#user');svg.append(use);
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
  function init(){accountIcon();navigation()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
