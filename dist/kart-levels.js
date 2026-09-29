export const LEVELS = Object.freeze([
  {
    id:'jerusalem', number:'01', name:'גביע הכנסת', english:'JERUSALEM GRAND PRIX',
    subtitle:'המסלול המקורי · דרכים סודיות ובוסטים', difficulty:'normal', speed:'150cc',
    badge:'המרוץ מתחיל כאן', color:'#d9fa73', sky:'#bcdde7', fog:'#bcdde7',
    sectors:['שדרות הכנסת','גשר ההבטחות','שוק הקואליציה','פארק הספינים']
  },
  {
    id:'market', number:'02', name:'מהומת השוק', english:'MARKET MAYHEM',
    subtitle:'מסלול הפוך · יותר מכשולים · יריבים מהירים', difficulty:'hard', speed:'200cc',
    badge:'קשה', color:'#ffb36f', sky:'#f1c9a5', fog:'#f1c9a5',
    sectors:['רחוב הסקרים','סמטת הפיתולים','שוק ההבטחות','הישורת האחרונה']
  },
  {
    id:'midnight', number:'03', name:'ליל ה־61', english:'THE 61ST NIGHT',
    subtitle:'מסלול לילה · בלי קיצורי דרך · AI קשוח', difficulty:'insane', speed:'250cc',
    badge:'סופר קשה', color:'#ff7494', sky:'#485d78', fog:'#485d78',
    sectors:['שער החצות','מדרגות הכוח','מרוץ המנדטים','הסיבוב המכריע']
  }
]);

export const levelById = id => LEVELS.find(level=>level.id===id) || LEVELS[0];
