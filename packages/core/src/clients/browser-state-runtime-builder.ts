export class BrowserStateRuntimeBuilder {
  static buildInlineHelpers(globalKey: string = '__FC_BROWSER_STATE__'): string {
    const normalizedGlobalKey = String(globalKey || '__FC_BROWSER_STATE__').trim() || '__FC_BROWSER_STATE__';

    return `(function(){var k=${JSON.stringify(normalizedGlobalKey)};if(window[k])return;window[k]={readQueryParam:function(name){try{return String(new URLSearchParams(window.location.search).get(name)||'').trim()}catch(e){return''}},getOrCreateLocalString:function(name,createValue){try{var existing=String(window.localStorage.getItem(name)||'').trim();if(existing)return existing;var next=String(createValue()||'').trim();if(next)window.localStorage.setItem(name,next);return next}catch(e){return''}},getOrCreateSessionString:function(name,createValue){try{var existing=String(window.sessionStorage.getItem(name)||'').trim();if(existing)return existing;var next=String(createValue()||'').trim();if(next)window.sessionStorage.setItem(name,next);return next}catch(e){return''}}};})();`;
  }
}
