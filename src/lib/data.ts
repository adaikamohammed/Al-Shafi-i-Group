
import type { Student } from './types';

// The initial data will now be empty.
// It will be populated by uploading an Excel file or adding manually.
export const students: Student[] = [];

export const sheikhData: { [email: string]: { name: string; group: string } } = {
  "admin1@gmail.com": { name: "الشيخ صهيب نصيب", group: "فوج 1" },
  "admin2@gmail.com": { name: "الشيخ زياد درويش", group: "فوج 2" },
  "admin3@gmail.com": { name: "الشيخ فؤاد بن عمر", group: "فوج 3" },
  "admin4@gmail.com": { name: "الشيخ أحمد بن عمر", group: "فوج 4" },
  "admin5@gmail.com": { name: "الشيخ إبراهيم مراد", group: "فوج 5" },
  "admin6@gmail.com": { name: "الشيخ عبد الحميد", group: "فوج 6" },
  "admin7@gmail.com": { name: "الشيخ سفيان نصيرة", group: "فوج 7" },
  "admin8@gmail.com": { name: "الشيخ عبد الحق نصيرة", group: "فوج 8" },
  "admin9@gmail.com": { name: "الشيخ عبد القادر", group: "فوج 9" },
  "admin10@gmail.com": { name: "الشيخ عبد القادر", group: "فوج 10" }
};
