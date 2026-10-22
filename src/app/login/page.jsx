import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Users, CalendarCheck, IndianRupee, Clock, BarChart3, FileText, ShieldCheck, Bell, Shield, Zap, PieChart, Building2, Phone } from "lucide-react";

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1
};

export const metadata = {
    title: "Login | KM Builders - Employee Management"
};

export default function LoginPage() {
    return (
        <main className="relative min-h-screen lg:h-screen w-full lg:overflow-hidden flex flex-col lg:flex-row" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

            {/* Fresh Modern Blue Gradient Background */}
            <div className="absolute inset-0 z-0 bg-blue-900" style={{
                backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 30%, #2563eb 70%, #3b82f6 100%)',
                backgroundSize: '100% 100%'
            }} />

            {/* Modern Mesh/Blur elements behind - Static */}
            <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
                {/* Large vibrant blue glow - top left */}
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[70%] rounded-full opacity-60 blur-[120px]" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(56,189,248,0.5) 0%, transparent 70%)'
                }} />
                {/* Deep purple/blue glow - bottom right */}
                <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[80%] rounded-full opacity-50 blur-[140px]" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)'
                }} />

                {/* Specifically behind the login form */}
                <div className="hidden lg:block absolute top-[50%] right-[15%] w-[400px] h-[400px] rounded-full opacity-70 blur-[100px] -translate-y-1/2" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(96,165,250,0.6) 0%, transparent 70%)'
                }} />
            </div>

            {/* Subtle dot pattern overlay */}
            <div className="absolute inset-0 z-[2] pointer-events-none opacity-20" style={{
                backgroundImage: `radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)`,
                backgroundSize: '32px 32px',
            }} />

            {/* CSS Animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmerText {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .login-fade-in { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
                .login-fade-in-1 { animation-delay: 0.1s; }
                .login-fade-in-2 { animation-delay: 0.2s; }
                .login-fade-in-3 { animation-delay: 0.3s; }
                .login-fade-in-4 { animation-delay: 0.4s; }
                .login-fade-in-5 { animation-delay: 0.5s; }
                
                .modern-glass-panel {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.15);
                }
                
                .school-photo-card {
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    position: relative;
                }
                .school-photo-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
                    pointer-events: none;
                }
                .school-photo-card:hover {
                    transform: translateY(-5px) scale(1.02);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.3);
                }
            `}} />

            {/* Left Content Area (Light text for contrast on blue) */}
            <div className="relative z-10 w-full lg:w-[55%] flex flex-col justify-between p-4 sm:p-6 lg:px-10 lg:py-0 min-h-screen lg:min-h-full">

                {/* Header - pinned at top with top spacing */}
                <div className="flex items-center gap-3 login-fade-in login-fade-in-1 pt-6 lg:pt-8">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white p-1 flex-shrink-0 shadow-lg border border-white/30 backdrop-blur-md overflow-hidden">
                        <img src="/km-builders-logo.png" alt="KM Builders Logo" className="h-full w-full object-contain" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-wide uppercase text-white m-0 leading-tight drop-shadow-md">KM BUILDERS</h2>
                        <p className="text-[10px] font-semibold tracking-widest text-amber-300 uppercase m-0 mt-0.5">Property Developers</p>
                    </div>


                </div>

                {/* Main Content - centered in remaining space */}
                <div className="max-w-[36rem] flex-1 flex flex-col justify-center py-4">
                    <div className="login-fade-in login-fade-in-2">
                        <div className="inline-flex items-center gap-2 modern-glass-panel rounded-full px-3 py-1 mb-3">
                            <Building2 className="w-3.5 h-3.5 text-blue-300" />
                            <span className="text-[11px] font-semibold text-blue-100 tracking-wide">Smart HR & Payroll System</span>
                        </div>
                        <h1 className="text-[1.8rem] lg:text-[2.2rem] xl:text-[2.5rem] font-extrabold mb-2 leading-[1.15]">
                            <span className="text-white drop-shadow-lg font-bold" style={{ fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '-0.02em' }}>KM BUILDERS </span><br />
                            <span className="italic" style={{
                                fontFamily: "'Georgia', serif",
                                backgroundImage: 'linear-gradient(135deg, #7dd3fc, #bae6fd, #e0f2fe)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundSize: '200% auto',
                                animation: 'shimmerText 5s linear infinite',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                            }}>FROM VISION TO REALITY</span>
                        </h1>
                    </div>
                    <p className="text-[13px] lg:text-[14px] text-blue-50 font-medium mb-4 leading-relaxed max-w-md login-fade-in login-fade-in-3 drop-shadow-sm opacity-90">
                        <span className="font-extrabold text-white tracking-wide">KM BUILDERS</span> — Turning your vision into reality with quality construction, innovative designs, and reliable building solutions.
                    </p>

                    {/* Company Photos */}
                    <div className="flex gap-3 mb-4 login-fade-in login-fade-in-3">
                        <div className="school-photo-card w-[140px] h-[70px] sm:w-[160px] sm:h-[80px] rounded-2xl overflow-hidden shadow-xl border border-white/20">
                            <img src="/km-building-exterior.jpg" alt="KM Builders Site" className="w-full h-full object-cover transition-transform duration-700 hover:scale-110" />
                        </div>
                        <div className="school-photo-card w-[160px] h-[70px] sm:w-[200px] sm:h-[80px] rounded-2xl overflow-hidden shadow-xl border border-white/20">
                            <img src="/km-office-interior.jpg" alt="KM Builders Office" className="w-full h-full object-cover transition-transform duration-700 hover:scale-110" />
                        </div>
                    </div>

                    {/* Modern Features Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 login-fade-in login-fade-in-4">
                        <FeatureCard icon={<Users className="text-blue-300 w-[20px] h-[20px]" />} title="Staff" subtitle="Management" />
                        <FeatureCard icon={<CalendarCheck className="text-emerald-300 w-[20px] h-[20px]" />} title="Attendance" subtitle="Tracking" />
                        <FeatureCard icon={<IndianRupee className="text-amber-300 w-[20px] h-[20px]" />} title="Salary" subtitle="Management" />
                        <FeatureCard icon={<Clock className="text-rose-300 w-[20px] h-[20px]" />} title="Leave" subtitle="Management" />
                    </div>

                    {/* Bottom Features Bar */}
                    <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-5 modern-glass-panel rounded-2xl px-4 sm:px-5 py-3 login-fade-in login-fade-in-5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-xl bg-white/10 shadow-inner">
                                <Shield className="text-emerald-400 w-[16px] h-[16px]" />
                            </div>
                            <div className="leading-tight">
                                <p className="font-bold text-[12px] sm:text-[13px] text-white">100%</p>
                                <p className="text-[9px] font-semibold text-blue-200 uppercase tracking-wide">Data Security</p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px h-6 bg-white/20"></div>
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-xl bg-white/10 shadow-inner">
                                <Zap className="text-amber-400 w-[16px] h-[16px]" />
                            </div>
                            <div className="leading-tight">
                                <p className="font-bold text-[12px] sm:text-[13px] text-white">Easy</p>
                                <p className="text-[9px] font-semibold text-blue-200 uppercase tracking-wide">To Manage</p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px h-6 bg-white/20"></div>
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-xl bg-white/10 shadow-inner">
                                <PieChart className="text-blue-300 w-[16px] h-[16px]" />
                            </div>
                            <div className="leading-tight">
                                <p className="font-bold text-[12px] sm:text-[13px] text-white">Real-time</p>
                                <p className="text-[9px] font-semibold text-blue-200 uppercase tracking-wide">Reports</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support Contact */}
                <div className="pb-5 lg:pb-7 pt-3 border-t border-white/10 flex items-center gap-3 login-fade-in login-fade-in-5">
                    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 shadow-inner flex items-center justify-center flex-shrink-0 text-emerald-400">
                        <Phone className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold tracking-wide text-blue-200">
                            For Support Call Or Message :
                        </p>
                        <a
                            href="tel:8299388507"
                            className="text-[13px] font-extrabold text-white tracking-wider hover:text-emerald-300 transition-colors inline-block mt-0.5"
                        >
                            8299388507
                        </a>
                    </div>
                </div>
            </div>

            {/* Right Side Card (Login Form) */}
            <div className="relative z-20 w-full lg:w-[45%] flex items-center justify-center p-4 sm:p-6 lg:p-8 min-h-[80vh] lg:h-screen pointer-events-none">

                {/* The main login card with clear white background and modern shadow */}
                <div className="w-full max-w-[420px] pointer-events-auto relative">

                    {/* Decorative ring behind the card matching the orange border glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 via-amber-300 to-orange-200 rounded-[1.3rem] blur opacity-40"></div>

                    <div className="relative flex flex-col rounded-2xl bg-white shadow-[0_0_40px_-10px_rgba(251,146,60,0.4)] border-[1.5px] border-orange-200 overflow-hidden">
                        <div className="p-6 sm:p-8 flex-grow">
                            <div className="mb-5">
                                <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200 mb-4 shadow-sm">
                                    <div className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Welcome To</span>
                                </div>
                                <h1 className="text-[1.6rem] font-extrabold tracking-tight text-slate-800 mb-1">
                                    KM BUILDERS
                                </h1>
                                <p className="text-[11px] font-bold text-slate-600 tracking-[0.12em] uppercase mb-4">
                                    HR Management Portal
                                </p>
                                <p className="text-[13.5px] font-normal text-slate-500/90 leading-[1.7] mt-1" style={{ fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.01em' }}>
                                    Sign In To Manage Staff, Salary, Attendance, Leaves And More.
                                </p>
                            </div>

                            <Suspense>
                                <LoginForm />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>

        </main>
    );
}

function FeatureCard({ icon, title, subtitle }) {
    return (
        <div className="modern-glass-panel rounded-xl p-3 flex flex-col items-start gap-2 hover:bg-white/10 transition-colors duration-300 cursor-default">
            <div className="bg-white/10 p-2 rounded-lg shadow-sm border border-white/10">
                {icon}
            </div>
            <div>
                <p className="text-[12px] font-bold text-white leading-tight">{title}</p>
                <p className="text-[10px] font-medium text-blue-200 leading-tight mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}
