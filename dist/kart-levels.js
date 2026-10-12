export const LEVELS = Object.freeze([
  {
    id: 'jerusalem',
    number: '01',
    name: 'גביע הכנסת',
    english: 'JERUSALEM GRAND PRIX',
    subtitle: 'מהכנסת, דרך גשר המיתרים ומחנה יהודה · שתי דרכים סודיות',
    difficulty: 'normal',
    speed: '150cc',
    badge: 'המרוץ מתחיל כאן',
    color: '#d9fa73',
    sky: '#bcdde7',
    fog: '#bcdde7',
    sectors: ['שדרות הכנסת', 'גשר המיתרים', 'מחנה יהודה', 'ימין משה'],
    signs: [
      ['שדרות הכנסת', 'Knesset Ave', 'شارع الكنيست'],
      ['גשר המיתרים', 'Chords Bridge', 'جسر الأوتار'],
      ['מחנה יהודה', 'Mahane Yehuda', 'محانيه يهودا'],
      ['ימין משה', 'Yemin Moshe', 'يمين موشيه']
    ],
    mood: 'day'
  },
  {
    id: 'market',
    number: '02',
    name: 'מהומת השוק',
    english: 'MARKET MAYHEM',
    subtitle: 'אותה עיר בכיוון ההפוך, שעת שקיעה · יותר מכשולים',
    difficulty: 'hard',
    speed: '200cc',
    badge: 'קשה',
    color: '#ffb36f',
    sky: '#f1c9a5',
    fog: '#f1c9a5',
    sectors: ['רחוב יפו', 'נחלאות', 'שוק מחנה יהודה', 'רחוב אגריפס'],
    signs: [
      ['רחוב יפו', 'Jaffa St', 'شارع يافا'],
      ['נחלאות', 'Nachlaot', 'نحلاؤوت'],
      ['שוק מחנה יהודה', 'Mahane Yehuda Market', 'سوق محانيه يهودا'],
      ['רחוב אגריפס', 'Agripas St', 'شارع أغريباس']
    ],
    mood: 'dusk'
  },
  {
    id: 'midnight',
    number: '03',
    name: 'ליל ה־61',
    english: 'THE 61ST NIGHT',
    subtitle: 'ירושלים בלילה · בלי קיצורי דרך · היריבים הכי חדים',
    difficulty: 'insane',
    speed: '250cc',
    badge: 'סופר קשה',
    color: '#ff7494',
    sky: '#485d78',
    fog: '#485d78',
    sectors: ['שער יפו', 'ממילא', 'כיכר ספרא', 'שדרות הכנסת'],
    signs: [
      ['שער יפו', 'Jaffa Gate', 'باب الخليل'],
      ['ממילא', 'Mamilla', 'ماميلا'],
      ['כיכר ספרא', 'Safra Square', 'ساحة صفرا'],
      ['שדרות הכנסת', 'Knesset Ave', 'شارع الكنيست']
    ],
    mood: 'night'
  }
]);

export const levelById = id => LEVELS.find(level => level.id === id) || LEVELS[0];
