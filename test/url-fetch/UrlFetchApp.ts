import HttpResponse from './HttpReponse';
import UrlFetchAppStubConfiguration from './UrlFetchAppStubConfiguration';

 export default class MUrlFetchApp {
   static fetch(url: string, _params: Record<string, string> = {}) {
     const data = UrlFetchAppStubConfiguration.get(url);
     if (data) {
       return data.response;
     }
     if (UrlFetchAppStubConfiguration.requests.length > 0) {
       // if UrlFetchAppStubConfiguration has stubs, means response not found
       return null;
     }
     return new HttpResponse();
   }

   static fetchAll(requests: { url: string; params: Record<string, string> }[]) {
     return requests.map((request) => this.fetch(request.url, request.params));
   }

   static getRequest(_url: string, _params: Record<string, string> = {}) {
     return {};
   }
 }