// Explicit provider hosts; no unsafe-inline/unsafe-eval for JavaScript.
export function analyticsPolicy(analytics) {
  const metrika=Number.isSafeInteger(Number(analytics.metrikaId))&&Number(analytics.metrikaId)>0;
  const ga4=/^G-[A-Z0-9]+$/.test(analytics.ga4Id||'');
  const hosts=metrika?['mc.yandex.ru','mc.yandex.az','mc.yandex.by','mc.yandex.co.il','mc.yandex.com','mc.yandex.com.am','mc.yandex.com.ge','mc.yandex.com.tr','mc.yandex.ee','mc.yandex.fr','mc.yandex.kg','mc.yandex.kz','mc.yandex.lt','mc.yandex.lv','mc.yandex.md','mc.yandex.tj','mc.yandex.tm','mc.yandex.uz','mc.webvisor.com','mc.webvisor.org']:[];
  const metrikaUrls=hosts.map(h=>'https://'+h);
  return {
    scriptSrc:["'self'",...metrikaUrls,...(metrika?['https://yastatic.net']:[]),...(ga4?['https://www.googletagmanager.com']:[])],
    connectSrc:["'self'",'https://api.roseen.ru',...metrikaUrls,...hosts.map(h=>'wss://'+h),...(ga4?['https://*.google-analytics.com','https://www.googletagmanager.com']:[])],
    imgSrc:["'self'",'data:',...metrikaUrls,...(ga4?['https://*.google-analytics.com']:[])],
    ...(metrika?{childSrc:["'self'",'blob:',...metrikaUrls],frameSrc:["'self'",'blob:',...metrikaUrls],frameAncestors:["'self'",'https://metrika.yandex.ru','https://metrica.yandex.ru','https://analytics.yandex.ru']}:{})
  };
}
