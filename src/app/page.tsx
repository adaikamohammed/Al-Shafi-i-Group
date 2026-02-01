"use client";

import PublicNavbar from '@/components/public/PublicNavbar';
import HeroSection from '@/components/public/HeroSection';
import StatsSection from '@/components/public/StatsSection';
import Footer from '@/components/public/Footer';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white" dir="rtl">
            <PublicNavbar />

            <main>
                <HeroSection />
                <StatsSection />

                {/* Gallery Preview Section */}
                <section id="gallery" className="py-20 bg-slate-50">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl font-black text-gray-900 mb-4 font-headline">معرض الصور</h2>
                        <p className="text-gray-500 mb-12 max-w-2xl mx-auto">جانب من أنشطة وفعاليات المدرسة القرآنية، حيث نجمع بين التعليم والتربية والترفيه الهادف.</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-96">
                            {/* Main Image - Group Photo (wide) */}
                            <div className="md:col-span-2 row-span-2 rounded-3xl bg-gray-200 overflow-hidden relative group">
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors z-10" />
                                <img
                                    src="/gallery/group-photo.jpg"
                                    alt="صورة جماعية لطلاب وأساتذة المدرسة"
                                    className="w-full h-full object-cover"
                                    style={{ objectPosition: 'center 35%' }}
                                />
                            </div>

                            {/* Activity 1 - Students at table */}
                            <div className="rounded-3xl bg-gray-200 overflow-hidden relative group">
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors z-10" />
                                <img
                                    src="/gallery/activity-5.jpg"
                                    alt="طلاب على الطاولة"
                                    className="w-full h-full object-cover"
                                    style={{ objectPosition: 'center center' }}
                                />
                            </div>

                            {/* Activity 2 - Students with teacher */}
                            <div className="rounded-3xl bg-gray-200 overflow-hidden relative group">
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors z-10" />
                                <img
                                    src="/gallery/activity-6.jpg"
                                    alt="طلاب مع الأستاذ"
                                    className="w-full h-full object-cover"
                                    style={{ objectPosition: 'center center' }}
                                />
                            </div>

                            {/* Wide Activity - Students entering */}
                            <div className="md:col-span-2 rounded-3xl bg-gray-200 overflow-hidden relative group">
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors z-10" />
                                <img
                                    src="/gallery/activity-1.jpg"
                                    alt="طلاب المدرسة"
                                    className="w-full h-full object-cover"
                                    style={{ objectPosition: 'center center' }}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section id="about" className="py-20">
                    <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1 relative h-96 rounded-3xl overflow-hidden shadow-2xl skew-x-3 hover:skew-x-0 transition-transform duration-500">
                            <img
                                src="/about-school.jpg"
                                alt="طلاب المدرسة مع الشيخ"
                                className="w-full h-full object-cover"
                                style={{ objectPosition: 'center center' }}
                            />
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <h2 className="text-4xl font-black text-gray-900 font-headline">عن المدرسة</h2>
                            <h3 className="text-xl text-primary font-bold">رؤية عصرية لتعليم القرآن الكريم</h3>
                            <p className="text-gray-600 leading-loose">
                                تأسست مدرسة الإمام الشافعي لتكون منارة للعلم والتربية في المنطقة. نعتمد منهجية متكاملة تجمع بين الحفظ المتقن، والفهم العميق، والعمل الصالح. نحرص على توفير بيئة محفزة وباستخدام أحدث التقنيات لمتابعة أداء الطلاب والتواصل مع الأولياء.
                            </p>
                            <ul className="space-y-3">
                                {['كادر تعليمي متخصص ومجاز', 'بيئة تربوية آمنة ومحفزة', 'مناهج متدرجة تناسب جميع الأعمار', 'أنشطة ترفيهية وتربوية مرافقة'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-700">
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs">✓</div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
