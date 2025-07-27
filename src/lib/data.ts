import type { Student } from './types';

export const students: Student[] = [
  {
    id: '1',
    fullName: 'عبد الرحمن بن صالح',
    guardianName: 'صالح الأحمد',
    phone1: '0501234567',
    birthDate: new Date('2010-05-15'),
    registrationDate: new Date('2022-09-01'),
    status: 'نشط',
    memorizedSurahsCount: 20,
    dailyMemorizationAmount: 'صفحة',
    notes: 'طالب مجتهد ومتميز في الحفظ.'
  },
  {
    id: '2',
    fullName: 'محمد بن علي',
    guardianName: 'علي العبدالله',
    phone1: '0559876543',
    birthDate: new Date('2011-02-20'),
    registrationDate: new Date('2022-09-01'),
    status: 'نشط',
    memorizedSurahsCount: 15,
    dailyMemorizationAmount: 'نصف',
    notes: 'يحتاج إلى متابعة في المراجعة.'
  },
  {
    id: '3',
    fullName: 'خالد بن فهد',
    guardianName: 'فهد المحمد',
    phone1: '0533456789',
    birthDate: new Date('2009-11-10'),
    registrationDate: new Date('2022-09-15'),
    status: 'غائب طويل',
    memorizedSurahsCount: 10,
    dailyMemorizationAmount: 'ربع',
    notes: 'سافر مع عائلته لمدة شهر.'
  },
  {
    id: '4',
    fullName: 'يوسف بن إبراهيم',
    guardianName: 'إبراهيم الحسن',
    phone1: '0547654321',
    birthDate: new Date('2012-08-30'),
    registrationDate: new Date('2023-01-10'),
    status: 'نشط',
    memorizedSurahsCount: 5,
    dailyMemorizationAmount: 'ربع',
  },
  {
    id: '5',
    fullName: 'سليمان بن عبد العزيز',
    guardianName: 'عبد العزيز الراشد',
    phone1: '0561122334',
    birthDate: new Date('2010-12-01'),
    registrationDate: new Date('2022-09-01'),
    status: 'نشط',
    memorizedSurahsCount: 35,
    dailyMemorizationAmount: 'صفحة',
  },
    {
    id: '6',
    fullName: 'أحمد بن عمر',
    guardianName: 'عمر الفاروق',
    phone1: '0512345678',
    birthDate: new Date('2008-01-01'),
    registrationDate: new Date('2022-09-01'),
    status: 'مطرود',
    memorizedSurahsCount: 8,
    dailyMemorizationAmount: 'ثمن',
    notes: 'تم طرده بسبب سلوك غير منضبط بشكل متكرر.'
  },
];
