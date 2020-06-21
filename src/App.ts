import * as express from "express";
import * as https from "https";
import * as md5 from "md5";
import * as cache from "cache";
import * as keystore from "./../keystore.json";

class App {
  public app: express.Application;

  private NUM_OF_RES: number = 100;
  private KEY: string = `?apikey=${keystore.publicKey}&ts=${keystore.ts}&hash=${md5(`${keystore.ts}${keystore.privateKey}${keystore.publicKey}`)}`;
  private BASE_URL: string = 'https://gateway.marvel.com:443/v1/public/characters'; 
  private EXPIRED_TIME: number = 1000 * 1000;//milli second

  private CACHE_FPATH: string = 'cache/character_id_list.json';
  private CACHE_KEY_ID_LIST = 'charIdList';

  private URL_CHARACTER = '/characters';

  private cacheArrCharId = new cache(this.EXPIRED_TIME, this.CACHE_FPATH);

  public static bootstrap (): App {
    return new App();
  }

  constructor () {
    this.app = express();
    this.app.get("/", (req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.send("Hello world.");
    });
    this.app.get(this.URL_CHARACTER, (req: express.Request, res: express.Response, next: express.NextFunction) => {
      let urlCharList = `${this.BASE_URL}${this.KEY}&limit=${this.NUM_OF_RES}`;
      let offset: number = +req.query.offset;
      let arrCharId = this.cacheArrCharId.get(this.CACHE_KEY_ID_LIST);
      let needReq = true;

      if(!Number.isNaN(offset)){
        urlCharList += `&offset=${offset}`;
      }else{
        offset = 0;
      }

      if(arrCharId !== null ){
        if(arrCharId.length >= (offset+this.NUM_OF_RES)){
          needReq = false;
        }else if(arrCharId.length < offset){
          res.send(`Please try offset data in 0~${arrCharId.length}`);
          return;
        }
      }else{
        arrCharId = [];
        if(offset != 0){
          res.send(`Sorry, you should use offset data 0. Try [  ${this.URL_CHARACTER}  ] or [  ${this.URL_CHARACTER}?offset=0  ]`);
          return;
        }
      }

      if(needReq){
        https.get(urlCharList, (resp) => {
          let data = '';
  
          resp.on('data', (chunk) => {
            data += chunk;
          });
          resp.on('end', () => {
            let resData = JSON.parse(data);
            let arrCharInfo = resData.data.results;
            
            for( let itemCharInfo of arrCharInfo){
              if(arrCharId.indexOf(itemCharInfo.id) == -1){
                arrCharId.push(itemCharInfo.id);
              }
            }
            this.cacheArrCharId.put(this.CACHE_KEY_ID_LIST, arrCharId);
            
            res.send(arrCharId);
          });
  
        }).on("error", (err) => {
          console.log("Error: " + err.message);
        });
      }else{
        res.send(arrCharId);
      }
      
    });

    this.app.get(`${this.URL_CHARACTER}/:characterId`, (req: express.Request, res: express.Response, next: express.NextFunction) => {

      const charId = req.params.characterId;
      https.get(`${this.BASE_URL}/${charId}${this.KEY}`, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
          data += chunk;
        });

        resp.on('end', () => {
          let resData = JSON.parse(data);
          let charInfo = resData.data.results[0];
          let outCharInfo = {
            id : charInfo.id,
            name : charInfo.name,
            description : charInfo.description
          };
          res.send(outCharInfo);
        });

      }).on("error", (err) => {
        console.log("Error: " + err.message);
      });
    });
  }
}

export default App;