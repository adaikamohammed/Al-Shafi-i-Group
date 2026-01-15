
"use client";

import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const quranQuotes = [
  { text: "خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ.", source: "رواه البخاري" },
  { text: "اقْرَءُوا القُرْآنَ فإنه يَأْتي يَومَ القِيامَةِ شَفِيعًا لأَصْحابِهِ.", source: "رواه مسلم" },
  { text: "إِنَّ اللَّهَ يَرْفَعُ بهذا الكِتابِ أَقْوامًا، ويَضَعُ به آخَرِينَ.", source: "رواه مسلم" },
  { text: "الْمَاهِرُ بالْقُرْآنِ مع السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ.", source: "متفق عليه" },
  { text: "يُجاءُ بالقرآنِ يومَ القيامةِ فيقولُ: يا ربِّ حَلِّهِ، فيُلبَسُ تاجَ الكرامةِ...", source: "رواه الترمذي (حسن صحيح)" },
  { text: "ينبغي لحامل القرآن أن يُعرف بليله إذا الناس نائمون، وبنهاره إذا الناس مفطرون...", source: "ابن مسعود رضي الله عنه" },
  { text: "لو طهرت قلوبكم ما شبعتم من كلام ربكم.", source: "عثمان بن عفان رضي الله عنه" },
  { text: "ضمن الله لمن اتبع القرآن أن لا يضل في الدنيا ولا يشقى في الآخرة.", source: "عبد الله بن عباس رضي الله عنهما" },
  { text: "من تعلم القرآن عظمت قيمته، ومن نظر في الفقه نبل قدره.", source: "الإمام الشافعي رحمه الله" },
  { text: "القرآن لا يعطيك بعضه حتى تعطيه كلك.", source: "حكم وأقوال تحفيزية" },
  { text: "بقدر حظك من القرآن يكون حظك من التوفيق والبركة في يومك.", source: "حكم وأقوال تحفيزية" },
  { text: "إن معلم القرآن كالغيث، أينما وقع نفع، ويكفيه فخراً أن الملائكة تستغفر له.", source: "حكم وأقوال تحفيزية" }
];


export function DailyInspiration() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [quote, setQuote] = useState({ text: '', source: '' });

  useEffect(() => {
    // This effect should only run on the client to avoid hydration mismatch
    const today = new Date();
    const dayOfMonth = today.getDate();
    // Select a quote based on the day of the month
    const currentQuote = quranQuotes[(dayOfMonth - 1) % quranQuotes.length];
    
    // Set greeting based on time
    const currentHour = today.getHours();
    const displayName = user?.displayName || 'شيخنا الكريم';

    if (currentHour < 12) {
      setGreeting(`طاب صباحك ${displayName}`);
    } else if (currentHour < 18) {
      setGreeting(`طاب يومك ${displayName}`);
    } else {
      setGreeting(`طاب مساؤك ${displayName}`);
    }
    
    setQuote(currentQuote);

  }, [user]);

  if (!quote.text) {
    // Return null or a loader on initial render to prevent hydration mismatch
    return null;
  }

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800">
        <Lightbulb className="h-8 w-8 text-yellow-600 flex-shrink-0 mt-1" />
        <div className="flex flex-col">
            <p className="font-bold text-lg">{greeting}</p>
            <p className="font-medium">{quote.text}</p>
            <p className="text-sm text-yellow-700 font-semibold mt-1">– {quote.source}</p>
        </div>
    </div>
  );
}
