/**
 * sportsConfig.js
 * -----------------------------------------------------------------------
 * เทียบเท่ากับแท็บ System_Config เดิมใน Google Sheets: กีฬา -> ทักษะ -> คำอธิบาย 6 Level
 * ย้ายมาเป็น static config เพราะแทบไม่เปลี่ยนบ่อย และไม่ต้องพึ่ง DB round-trip
 * ทุกครั้งที่โหลดหน้าแรก (ถ้าต้องการแก้ไขผ่านหน้าเว็บในอนาคต ค่อยย้ายเข้า DB ทีหลังได้)
 */

export const SPORTS_MASTER = {
  'ฟุตซอล (Futsal)': ['Ball Control', 'Passing', 'Shooting', 'Defending', 'Agility'],
  'บาสเกตบอล (Basketball)': ['Dribbling', 'Passing', 'Shooting', 'Rebounding', 'Footwork'],
  'เทนนิส (Tennis)': ['Serve', 'Forehand', 'Backhand', 'Volley', 'Footwork'],
  'ปิงปอง (Table Tennis)': ['Grip & Stance', 'Serve', 'Drive', 'Push/Chop', 'Footwork'],
  'แบดมินตัน (Badminton)': ['Serve', 'Clear', 'Smash', 'Drop', 'Net Play'],
  'เทควันโด (Taekwondo)': ['Stance', 'Basic Kicks', 'Advanced Kicks', 'Blocks', 'Poomsae'],
  'มวย (Boxing/Muay Thai)': ['Punches', 'Kicks/Knees', 'Defense', 'Footwork', 'Stamina'],
  'กอล์ฟ (Golf)': ['Setup', 'Full Swing', 'Short Game', 'Putting', 'Course Management'],
};

export const LEVEL_TEMPLATES = [
  'Level 1 (Novice): รู้จักอุปกรณ์และตั้งท่าพื้นฐานของ {skill} ได้ถูกต้อง แต่ยังควบคุมไม่ได้',
  'Level 2 (Learner): ทำ {skill} ขั้นพื้นฐานได้ในสภาวะควบคุม (ระหว่างการซ้อม)',
  'Level 3 (Competent): ทำ {skill} ได้ถูกต้องแม่นยำตามมาตรฐานในเกมจำลอง',
  'Level 4 (Proficient): ชำนาญ นำ {skill} ไปใช้ในเกมแข่งขันจริงได้ตามแทกติก',
  'Level 5 (Advanced): มีเทคนิคพิเศษเชิงลึกใน {skill} แก้ปัญหาเฉพาะหน้าในเกมที่มีความกดดันได้ดี',
  'Level 6 (Elite/Leader): {skill} สมบูรณ์แบบระดับตัวแทนแข่งขัน และสาธิตสอนผู้อื่นได้',
];

/** รายชื่อกีฬาตามลำดับที่กำหนดไว้ */
export function getSportNames() {
  return Object.keys(SPORTS_MASTER);
}

/** รายชื่อทักษะของกีฬาหนึ่ง (throw ถ้าไม่รู้จักกีฬานี้) */
export function getSkillsForSport(sport) {
  const skills = SPORTS_MASTER[sport];
  if (!skills) throw new Error('ไม่รู้จักชนิดกีฬา "' + sport + '"');
  return skills;
}

/** โครงสร้างเต็มสำหรับส่งให้ frontend: [{ name, skills:[...], defs:{ skill:{1:"...",...,6:"..."} } }] */
export function getAllSportsWithDefs() {
  return getSportNames().map((name) => {
    const skills = SPORTS_MASTER[name];
    const defs = {};
    skills.forEach((skill) => {
      defs[skill] = {};
      LEVEL_TEMPLATES.forEach((tpl, i) => {
        defs[skill][i + 1] = tpl.replace('{skill}', skill);
      });
    });
    return { name, skills, defs };
  });
}
