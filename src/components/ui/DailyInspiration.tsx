
"use client";

import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';

const quranQuotes = [
  { text: "تعليم أبنائنا القرآن هو أساس التربية الإسلامية. قال النبي ﷺ: 'خيركم من تعلّم القرآن وعلمه'.", source: "حديث شريف" },
  { text: "منهجه ﷺ في تعليم القرآن لم يكن مجرد حفظ، بل تعليم للحكمة والتزكية والتطبيق. قال تعالى: 'ويُزَكِّيهِمْ ويُعَلِّمُهُمُ الْكِتَابَ وَالْحِكْمَةَ'.", source: "آية قرآنية (آل عمران: 164)" },
  { text: "القرآن منهج رباني لتنشئة النشء، ركيزة لبناء الأمة من بين الأمم بقيم الإيمان والسلوك الصحيح.", source: "مقالة تربوية" },
  { text: "المداومة على القرآن تزكّي النفوس وترقّق القلوب، ويصبح الطفل مدركًا لقيمة ما في يده.", source: "توجيه إيماني" },
  { text: "من سلك طريقًا يلتمس فيه علمًا، سهل الله له طريقًا إلى الجنة.", source: "حديث شريف" },
  { text: "احفظ الله يحفظك.. تعلم القرآن وتطبيقه يحفظك في الدنيا والآخرة.", source: "حديث نبوي" },
  { text: "أفضل ما يترك الإنسان: ولد صالح يدعو له، وعلم ينتفع به.", source: "حديث شريف" },
  { text: "التربية بالقرآن ليست حفظ حروف فقط، بل غرس قيم مثل الصدق والصبر لبناء جيل صالح.", source: "رؤية تربوية" },
  { text: "الصبر في ميدان الحفظ والمعرفة خلق مؤمن عميق. فالصبر من قِيم الإيمان.", source: "نصيحة تربوية" },
  { text: "العلم نور القلب وسلاحه، والقرآن يُرسّخ الثبات والمعرفة والسكينة.", source: "مقولة تربوية" },
  { text: "من أحب القرآن أحبه الله، ومن أقبل عليه رفعه الله في الدنيا والآخرة.", source: "مقولة لابن مسعود" },
  { text: "الطفل الذي ينشأ مع كتاب الله، لا يخشى ضياع الطريق مهما اشتدت الظلمات.", source: "توجيه أسري" },
  { text: "من أعظم صور البر: تعليم الابن القرآن وتربيته على حب كلام الله.", source: "توصية تربوية" },
  { text: "القرآن مفتاح الفهم والإصلاح.. وغرس حبِّه في الصغار صدقة جارية لا تنقطع.", source: "مقالة تربوية" },
  { text: "قال الإمام مالك: 'تعلموا الأدب قبل العلم'. والقرآن يجمعهما معًا.", source: "أثر عن مالك بن أنس" },
  { text: "من جالس القرآن فلا يندم.. ومن سار معه لا يضل.", source: "مقولة" },
  { text: "قال الشيخ ابن باز: 'ما نفع الله به الناس أعظم من كتابه العزيز، فليكن شغلكم الشاغل'.", source: "من فتاوى ابن باز" },
  { text: "الأطفال الذين يحفظون القرآن يختلفون في السلوك والضبط النفسي عن أقرانهم.", source: "دراسة تربوية" },
  { text: "سعادة المربي في رؤية تلاميذه يحملون القرآن في صدورهم وأخلاقهم.", source: "رسالة تشجيعية" },
  { text: "كل يوم يمر من غير تدبر آية، هو يوم ناقص من بركة العلم والإيمان.", source: "مقولة تدبرية" },
  { text: "قال الشافعي: 'من تعلّم القرآن عظمت قيمته'.", source: "أثر عن الإمام الشافعي" },
  { text: "التعليم القرآني يصنع الشخص المتزن الصبور.. المتأمل في غاياته ومقاصده.", source: "مقالة فكرية" },
  { text: "اجعل القرآن رفيق يومك في التربية، تجد السكينة تُظلل بيتك وتلاميذك.", source: "نصيحة أبوية" },
  { text: "أكرم الناس من تعلّم القرآن وعلّمه وأخلص لله نيّته.", source: "حديث شريف" },
  { text: "أبناؤكم أمانة.. وقرآن يُحفَظ فيهم نور لكم يوم تبيضّ الوجوه.", source: "مقولة توعوية" },
  { text: "التربية بالقرآن طريق لصناعة الأمل في أجيال تنهض بالحق وترفض الباطل.", source: "مقال تحفيزي" },
  { text: "قراءة الصغير للقرآن بصوت خاشع، أعظم من كنوز الدنيا في قلب المعلم المخلص.", source: "قصة مؤثرة" },
  { text: "لا يوجد كتاب يربّي كالقرآن.. ولا قيمة أعظم من تنشئة الأطفال عليه.", source: "قول مأثور" },
  { text: "من أراد أن يملأ بيته نورًا وبركة، فليكن فيه مجلس يومي للقرآن.", source: "توصية أسرية" },
  { text: "احرص على ألا ينتهي يومك دون أن تهدي تلميذك آية فيها نور ونجاة.", source: "نصيحة للمربين" },
  { text: "القرآن كالمطر.. ينبت في كل قلب ما يناسبه من الثمر. ازرعه في كل طالب وثِق بالنتيجة.", source: "تأمل قرآني" }
];


export function DailyInspiration() {
  const [quote, setQuote] = useState({ text: 'جارٍ التحميل...', source: '' });

  useEffect(() => {
    // This effect should only run on the client
    const today = new Date().getDate();
    const currentQuote = quranQuotes[(today - 1) % quranQuotes.length];
    
    const storedDate = localStorage.getItem('quote-date');
    
    let quoteText, quoteSource;

    if (storedDate !== today.toString()) {
      localStorage.setItem('quote-date', today.toString());
      localStorage.setItem('quote-text', currentQuote.text);
      localStorage.setItem('quote-source', currentQuote.source);
      quoteText = currentQuote.text;
      quoteSource = currentQuote.source;
    } else {
      quoteText = localStorage.getItem('quote-text') || currentQuote.text;
      quoteSource = localStorage.getItem('quote-source') || currentQuote.source;
    }
    
    setQuote({ text: quoteText, source: quoteSource });

  }, []);

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
        <Lightbulb className="h-8 w-8 text-yellow-600 flex-shrink-0" />
        <div className="flex flex-col">
            <p className="font-medium">{quote.text}</p>
            <p className="text-sm text-yellow-700 font-semibold mt-1">– {quote.source}</p>
        </div>
    </div>
  );
}

    