/* ═══════════════════════════════════════════════════════════════
   Footer flotante Naowee — animación scroll
   Aparece al hacer scroll DOWN, desaparece al hacer scroll UP.
   Listener atado a .page (el contenedor con overflow-y:auto del shell)
   con fallback a window por si la página no usa el shell.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  function bind(){
    var footer = document.querySelector('.naowee-floating-footer');
    if(!footer) return;
    var page = document.querySelector('.page');
    var target = page || window;
    var getY = page ? function(){ return page.scrollTop; } : function(){ return window.scrollY || window.pageYOffset || 0; };
    var lastY = getY();
    target.addEventListener('scroll', function(){
      var y = getY();
      var dy = y - lastY;
      if(Math.abs(dy) < 4) return;
      if(dy > 0){ footer.classList.remove('is-hidden'); }
      else { footer.classList.add('is-hidden'); }
      lastY = y;
    }, { passive:true });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
