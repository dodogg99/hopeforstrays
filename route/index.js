import express from 'express';
import crypto from 'crypto';
import 'dotenv/config';

const router = express.Router();
const RespondType = 'JSON';
const orders = {};
const {
    MerchantID,
    HASHKEY,
    HASHIV,
    Version,
    PayGateWay,
    NotifyUrl,
    ReturnUrl,
  } = process.env;

router.get('/', (req, res) => {
    res.render('index', {title: 'express'});
  });

router.post('/createOrder', (req, res) => {
  const data = req.body;
  console.log(data);

  // 使用 Unix Timestamp 作為訂單編號（金流也需要加入時間戳記）
  const TimeStamp = Math.round(new Date().getTime() / 1000);
  const order = {
    ...data,
    TimeStamp,
    Amt: parseInt(data.Amt),
    MerchantOrderNo: TimeStamp,
  };

  // 進行訂單加密
  // 加密第一段字串，此段主要是提供交易內容給予藍新金流
  const aesEncrypt = createAesEncrypt(order);
  console.log('aesEncrypt:', aesEncrypt);

  // 使用 HASH 再次 SHA 加密字串，作為驗證使用
  const shaEncrypt = createShaEncrypt(aesEncrypt);
  console.log('shaEncrypt:', shaEncrypt);
  order.aesEncrypt = aesEncrypt;
  order.shaEncrypt = shaEncrypt;

  orders[TimeStamp] = order;
  console.log(orders[TimeStamp]);

  res.redirect(`/check/${TimeStamp}`);
});

router.get('/check/:id', (req, res, next) => {
  const { id } = req.params;
  const order = orders[id];
  console.log(order);
  res.render('check', {
    title: 'Express',
    PayGateWay,
    Version,
    order,
    MerchantID,
  });
});

// 交易成功：Return （可直接解密，將資料呈現在畫面上）
router.post('/newebpay_return', function (req, res, next) {
  console.log('req.body return data', req.body);
  //bodyParser middleware會自動將收到的body轉換為object格式
  const status = req.body.Status;
  if (status === 'SUCCESS') {
    res.render('finish', { title: 'Express', status: '結帳成功'});
  } else {
    res.render('finish', { title: 'Express', status: status});
  }
});

// 確認交易：Notify
router.post('/newebpay_notify', function (req, res, next) {
  try {
  console.log('req.body notify data', req.body);
  const response = req.body;
  // 解密交易內容
  const data = createAesDecrypt(response.TradeInfo);
  console.log('data:', data);
  } catch (error) {
    console.log(`error: ${error}`);
  }
  // 取得交易內容，並查詢本地端資料庫是否有相符的訂單
  console.log(orders[data?.Result?.MerchantOrderNo]);
  if (!orders[data?.Result?.MerchantOrderNo]) {
    console.log('找不到訂單');
    return res.end();
  }

  // 使用 HASH 再次 SHA 加密字串，確保比對一致（確保不正確的請求觸發交易成功）
  const thisShaEncrypt = createShaEncrypt(response.TradeInfo);
  if (!thisShaEncrypt === response.TradeSha) {
    console.log('付款失敗：TradeSha 不一致');
    return res.end();
  }

  // 交易完成，將成功資訊儲存於資料庫
  console.log('付款完成，訂單：', orders[data?.Result?.MerchantOrderNo]);

  return res.end();
});

// 字串組合
function genDataChain(order) {
    return `MerchantID=${MerchantID}&RespondType=${RespondType
    }&TimeStamp=${order.TimeStamp
    }&Version=${Version}&MerchantOrderNo=${order.MerchantOrderNo
    }&Amt=${order.Amt}&ItemDesc=${encodeURIComponent(
      order.ItemDesc,
    )}&ReturnURL=${encodeURIComponent(ReturnUrl)
    }&NotifyURL=${encodeURIComponent(NotifyUrl,)
    }&Email=${encodeURIComponent(order.Email)}`;
  }

function createAesEncrypt(tradeInfo) {
    const encrypt = crypto.createCipheriv('aes-256-cbc', HASHKEY, HASHIV);
    const enc = encrypt.update(genDataChain(tradeInfo), 'utf8', 'hex');
    return enc + encrypt.final('hex');
}

function createShaEncrypt(aesEncrypt) {
    const sha = crypto.createHash('sha256');
    const plainText = `HashKey=${HASHKEY}&${aesEncrypt}&HashIV=${HASHIV}`;
    return sha.update(plainText).digest('hex').toUpperCase();
  }
  
  // 對應文件 21, 22 頁：將 aes 解密
function createAesDecrypt(tradeInfo) {
  const decrypt = crypto.createDecipheriv('aes-256-cbc', HASHKEY, HASHIV);
  const dec = decrypt.update(tradeInfo, 'hex', 'utf8');
  const plainText = dec + decrypt.final('utf8');
  const result = plainText.replace(/[\x00-\x20]+/g, '');
  return JSON.parse(result);
  // return JSON.parse(result);
}

export default router;