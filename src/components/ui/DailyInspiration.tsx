"use client";

import React, { useState, useEffect } from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PORTAL_THEMES } from '@/lib/themes';

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

  const currentThemeId = user?.portalTheme || 'midnight';
  const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

  useEffect(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentQuote = quranQuotes[(dayOfMonth - 1) % quranQuotes.length];

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

  if (!quote.text) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden group p-6 rounded-[2rem] border backdrop-blur-md",
        theme.isLight ? "bg-amber-50 border-amber-100 shadow-xl shadow-amber-200/20" : "bg-amber-500/10 border-amber-500/20"
      )}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-500">
        <Sparkles className="h-16 w-16 text-amber-400" />
      </div>

      <div className="flex items-start gap-5 relative z-10">
        <div className={cn(
          "p-3 rounded-2xl shadow-lg",
          theme.isLight ? "bg-amber-100 text-amber-600 shadow-amber-200/50" : "bg-amber-500/20 text-amber-400 shadow-amber-500/10"
        )}>
          <Lightbulb className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <p className={cn("font-headline font-bold text-lg", theme.isLight ? "text-amber-800" : "text-amber-200")}>{greeting}</p>
          <p className={cn("font-medium leading-relaxed italic", theme.isLight ? "text-slate-600" : "text-white/80")}>"{quote.text}"</p>
          <div className="flex items-center gap-2 pt-2">
            <div className={cn("h-1 w-6 rounded-full", theme.isLight ? "bg-amber-200" : "bg-amber-500/30")} />
            <p className={cn("text-xs font-bold uppercase tracking-widest", theme.isLight ? "text-amber-600/60" : "text-amber-400/60")}>{quote.source}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
