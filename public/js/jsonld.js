// Inject JSON-LD structured data
(function(){
  var schemas = [
    {"@context":"https://schema.org","@type":"Organization","name":"DishRank","url":"https://dishrank.fr","logo":"https://dishrank.fr/img/icon.png","description":"Note les plats, pas les restos.","contactPoint":{"@type":"ContactPoint","email":"contact@dishrank.fr","contactType":"customer service"},"sameAs":["https://play.google.com/store/apps/details?id=com.dishrank.app","https://www.instagram.com/dishrank.app"]},
    {"@context":"https://schema.org","@type":"WebApplication","name":"DishRank","url":"https://dishrank.fr","applicationCategory":"LifestyleApplication","operatingSystem":"Android","installUrl":"https://play.google.com/store/apps/details?id=com.dishrank.app","offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"}}
  ];
  schemas.forEach(function(s){
    var el=document.createElement('script');
    el.type='application/ld+json';
    el.textContent=JSON.stringify(s);
    document.head.appendChild(el);
  });
})();
