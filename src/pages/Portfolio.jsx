import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowRight, 
  Code2, 
  Cpu, 
  Layers, 
  Search, 
  Send, 
  Sparkles, 
  Tv, 
  Compass, 
  CheckCircle2, 
  UserCheck, 
  ShieldCheck 
} from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './Portfolio.css'

const PROJECTS = [
  {
    title: 'Totsan V2',
    subtitle: 'Interior Design & Renovation Platform',
    role: 'Lead Full-Stack Web Developer',
    duration: '4 Months',
    focus: 'React, Tailwind, Supabase, GSAP',
    description: 'A comprehensive marketplace matching clients with certified contractors. Features interactive timeline exploration, complex request wizard, and a real-time secure messaging system.',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    liveLink: '/'
  },
  {
    title: 'Hannah Macready',
    subtitle: 'Bespoke Copywriting Portfolio',
    role: 'Creative Motion Developer',
    duration: '3 Weeks',
    focus: 'Vanilla JS, GSAP, WebGL, custom Canvas',
    description: 'An editorial portfolio for an award-winning copywriter. Heavy focus on micro-animations, trailing custom cursors, and custom transitions that highlight textual design.',
    image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    liveLink: '#'
  },
  {
    title: 'Mercer Timber',
    subtitle: 'Mass Timber Sustainability Catalog',
    role: 'Front-End UI Engineer',
    duration: '2 Months',
    focus: 'Vite, React, Tailwind, Framer Motion',
    description: 'An interactive showcase detailing ecological timber building phases, featuring video evolution layers and performance-optimized canvas loaders.',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
    liveLink: '#'
  },
  {
    title: 'Aura Wellness',
    subtitle: 'AuraSpa Premium E-Commerce',
    role: 'Creative Director & Web Developer',
    duration: '2 Months',
    focus: 'React, Next.js, Stripe, Tailwind CSS',
    description: 'A luxurious digital spa storefront. Integrates Stripe Checkout, custom-curated dynamic audio streams, and smooth page transitions with CSS clip-paths.',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    liveLink: '#'
  }
]

const SERVICES = [
  {
    icon: Code2,
    title: 'Custom Web Apps',
    desc: 'High-performance applications built using React, Vite, Next.js, and solid state-management principles. Clean, scalable codebases structured for longevity.'
  },
  {
    icon: Tv,
    title: 'Creative Motion Design',
    desc: 'Premium user experiences with smooth page transitions, custom cursors, physics-based scroll triggers, and SVG morphs using GSAP and Framer Motion.'
  },
  {
    icon: Cpu,
    title: 'Headless & Backend Integration',
    desc: 'Flexible architectures connecting modern frontends with secure backends, realtime databases, and serverless authentication (Supabase, Firebase, REST/GraphQL).'
  },
  {
    icon: Sparkles,
    title: 'SEO & Core Web Vitals',
    desc: 'Optimized page load speeds, clean HTML semantics, metadata injections, and accessibility structures tailored for search engines and user engagement.'
  }
]

const PROCESS_STEPS = [
  {
    num: '01',
    phase: 'Plan & Design System',
    title: 'Laying the foundation',
    desc: 'We define the content model, typographic scale, color system, and layout grid. This ensures absolute alignment of branding, aesthetics, and structure before writing logic.'
  },
  {
    num: '02',
    phase: 'Core Architecture',
    title: 'Developing components',
    desc: 'Setting up clean state containers, layout files, and page routes. We ensure code is modular, reusable, and optimized for maximum speed.'
  },
  {
    num: '03',
    phase: 'Motion & UX Polishing',
    title: 'Bringing it to life',
    desc: 'Integrating GSAP timelines, setting up ScrollTriggers, building cursor-interactivity, and tailoring entrance animations that engage and guide the user.'
  },
  {
    num: '04',
    phase: 'SEO & Deployment',
    title: 'Launching to the web',
    desc: 'Verifying Core Web Vitals, testing cross-browser responsiveness, configuring meta descriptions, schema JSON-LD, and deploying onto optimized CDN networks.'
  }
]

export default function Portfolio() {
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [processActive, setProcessActive] = useState(0)
  
  const cursorRef = useRef(null)
  const containerRef = useRef(null)
  const pinWrapperRef = useRef(null)
  const laptopRef = useRef(null)
  
  // Custom contact form states
  const [formState, setFormState] = useState({ name: '', email: '', message: '', budget: '1500-3000' })
  const [formSubmitted, setFormSubmitted] = useState(false)

  // 1. Loading screen simulation
  useEffect(() => {
    if (progress < 100) {
      const timer = setTimeout(() => {
        setProgress(prev => Math.min(prev + Math.floor(Math.random() * 12) + 6, 100))
      }, 70)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        setLoading(false)
        triggerEntranceAnimations()
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [progress])

  // 2. Custom cursor tracking with lerp
  useEffect(() => {
    if (loading) return
    const cursor = cursorRef.current
    if (!cursor) return

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let cursorX = mouseX
    let cursorY = mouseY

    const onMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    window.addEventListener('mousemove', onMouseMove)

    const tick = () => {
      cursorX += (mouseX - cursorX) * 0.14
      cursorY += (mouseY - cursorY) * 0.14

      if (cursor) {
        cursor.style.left = `${cursorX}px`
        cursor.style.top = `${cursorY}px`
      }
      requestAnimationFrame(tick)
    }

    const animFrame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(animFrame)
    }
  }, [loading])

  // 3. Entrance GSAP animations
  const triggerEntranceAnimations = () => {
    gsap.fromTo('.anim-hero-title', 
      { filter: 'blur(30px)', opacity: 0, y: 50 },
      { filter: 'blur(0px)', opacity: 1, y: 0, duration: 1.2, ease: 'power4.out', delay: 0.2 }
    )
    
    gsap.fromTo('.anim-hero-sub', 
      { filter: 'blur(20px)', opacity: 0, y: 25 },
      { filter: 'blur(0px)', opacity: 1, y: 0, duration: 1.0, ease: 'power3.out', delay: 0.6 }
    )
    
    gsap.fromTo('.anim-hero-nav',
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.8 }
    )
  }

  // 4. GSAP ScrollTrigger for Mockup Showcase (Desktop only)
  useEffect(() => {
    if (loading) return
    if (window.innerWidth < 1024) return

    gsap.registerPlugin(ScrollTrigger)

    const container = containerRef.current
    const pinWrapper = pinWrapperRef.current

    // Pin timeline mapping
    const pinTrigger = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      pin: pinWrapper,
      scrub: true,
      onUpdate: (self) => {
        setScrollProgress(self.progress)
        const idx = Math.min(Math.floor(self.progress * PROJECTS.length), PROJECTS.length - 1)
        setActiveIndex(idx)
      }
    })

    // Mockup Entrance & Scaling timeline
    const laptopTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top 80%',
        end: 'top top',
        scrub: 1
      }
    })

    laptopTimeline.fromTo(laptopRef.current,
      { scale: 0.5, yPercent: 40 },
      { scale: 1, yPercent: 0, ease: 'power2.out' }
    )

    return () => {
      if (pinTrigger) pinTrigger.kill()
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [loading])

  const handleFormSubmit = (e) => {
    e.preventDefault()
    setFormSubmitted(true)
    setTimeout(() => {
      setFormState({ name: '', email: '', message: '', budget: '1500-3000' })
    }, 2000)
  }

  return (
    <div className="portfolio-body relative selection:bg-[#212E02] selection:text-[#F0EFE9]">
      {/* 1. Custom Trailing Cursor */}
      {!loading && (
        <div 
          ref={cursorRef} 
          className={`portfolio-custom-cursor hidden md:flex ${hovering ? 'hovering' : ''}`} 
        />
      )}

      {/* 2. Page Loader Screen */}
      {loading && (
        <div className="portfolio-loader">
          <div className="portfolio-loader-logo portfolio-serif italic">M.</div>
          <div className="portfolio-loader-bar">
            <div className="portfolio-loader-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="portfolio-loader-percent">{progress}%</div>
        </div>
      )}

      {/* 3. standalone Navigation */}
      <header className="anim-hero-nav opacity-0 fixed top-0 left-0 right-0 z-50 px-6 py-5 flex justify-between items-center bg-[#F0EFE9]/85 backdrop-blur-md border-b border-[#212E02]/5">
        <Link to="/" className="portfolio-serif text-3xl font-bold tracking-tight text-[#212E02]">
          Mitkov<span className="italic text-lg font-light opacity-60 ml-2">Web Studio</span>
        </Link>
        <nav className="flex gap-8 text-sm font-semibold tracking-wide uppercase text-[#212E02]/70">
          <a href="#work" className="portfolio-nav-link hover:text-[#212E02]">Selected Work</a>
          <a href="#services" className="portfolio-nav-link hover:text-[#212E02]">Services</a>
          <a href="#process" className="portfolio-nav-link hover:text-[#212E02]">My Process</a>
          <a href="#contact" className="portfolio-nav-link hover:text-[#212E02]">Start Project</a>
        </nav>
      </header>

      {/* 4. Hero Intro Section */}
      <section className="relative min-h-[92vh] flex flex-col justify-center px-6 md:px-16 pt-24 pb-12 overflow-hidden bg-gradient-to-br from-[#F0EFE9] to-[#E9E8E2]">
        <DecorativeShapes />

        <div className="relative z-10 max-w-5xl mx-auto w-full">
          <span className="anim-hero-sub opacity-0 inline-flex items-center gap-2 rounded-full border border-[#212E02]/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#212E02] mb-6">
            <Sparkles size={13} /> CREATIVE WEB DEVELOPER & DESIGNER
          </span>

          <h1 className="anim-hero-title opacity-0 portfolio-serif text-[clamp(2.5rem,5.5vw,7.5rem)] leading-[0.98] text-[#212E02] tracking-tight">
            I craft digital products <br />
            with <span className="italic font-light">premium motion</span> & details.
          </h1>

          <p className="anim-hero-sub opacity-0 mt-8 max-w-2xl text-lg md:text-xl text-[#212E02]/70 leading-relaxed portfolio-sans">
            Specializing in high-end React, Vite, and GSAP experiences. I build bespoke websites for brands that want to leave a lasting impression and sell their services.
          </p>

          <div className="anim-hero-sub opacity-0 mt-10 flex flex-wrap gap-4">
            <a 
              href="#work" 
              className="btn !bg-[#212E02] !text-[#F0EFE9] hover:opacity-90 font-medium px-8 py-4 text-base"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              Explore Selected Work
            </a>
            <a 
              href="#contact" 
              className="btn border border-[#212E02]/20 hover:border-[#212E02] text-[#212E02] font-medium px-8 py-4 text-base"
            >
              Get In Touch
            </a>
          </div>
        </div>
      </section>

      {/* 5. Horizontal Slider Section (Pinned scroll sequences) */}
      <section id="work" className="portfolio-slider-container" ref={containerRef} style={{ height: window.innerWidth >= 1024 ? `${PROJECTS.length * 100}vh` : 'auto' }}>
        <div className="portfolio-slider-pin-wrapper" ref={pinWrapperRef}>
          <div className="portfolio-slider-layout">
            
            {/* Left Column: Pinned Mockup laptop */}
            <div className="portfolio-laptop-wrapper">
              <div className="portfolio-laptop-mockup" ref={laptopRef}>
                <div className="portfolio-laptop-screen">
                  <div className="portfolio-laptop-media-stack">
                    {PROJECTS.map((project, index) => (
                      <div 
                        key={project.title} 
                        className={`portfolio-laptop-slide ${index === activeIndex ? 'active' : ''}`}
                      >
                        <img src={project.image} alt={project.title} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Text Metadata Info crossfades */}
            <div className="portfolio-details-stack">
              {/* Custom vertical indicator bar */}
              <div className="portfolio-scrollbar-track">
                <div 
                  className="portfolio-scrollbar-thumb" 
                  style={{ height: `${(scrollProgress * 100) || 5}%` }}
                />
              </div>

              {PROJECTS.map((project, index) => (
                <article 
                  key={project.title} 
                  className={`portfolio-project-details ${index === activeIndex ? 'active' : ''}`}
                >
                  <div className="text-sm font-semibold uppercase tracking-widest text-[#212E02]/60 mb-2">
                    Project 0{index + 1} / 0{PROJECTS.length}
                  </div>
                  <h2 className="portfolio-serif text-5xl md:text-6xl text-[#212E02] mb-4">
                    {project.title}
                  </h2>
                  <h3 className="text-lg font-medium text-[#212E02] mb-6">
                    {project.subtitle}
                  </h3>
                  
                  <p className="text-[#212E02]/70 leading-relaxed mb-8 portfolio-sans">
                    {project.description}
                  </p>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-b border-[#212E02]/10 py-6 mb-8 text-sm">
                    <div>
                      <div className="text-xs uppercase text-[#212E02]/50 mb-1">Role</div>
                      <div className="font-semibold text-[#212E02]">{project.role}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-[#212E02]/50 mb-1">Duration</div>
                      <div className="font-semibold text-[#212E02]">{project.duration}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-[#212E02]/50 mb-1">Focus</div>
                      <div className="font-semibold text-[#212E02]">{project.focus}</div>
                    </div>
                  </div>

                  <a 
                    href={project.liveLink}
                    className="link-arrow font-medium !text-[#212E02] !border-[#212E02] hover:!text-[#212E02]/75 hover:!border-[#212E02]/75"
                  >
                    View Project <ArrowRight size={15} />
                  </a>
                </article>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* 6. Services Offered Grid */}
      <section id="services" className="section bg-[#E9E8E2] border-t border-[#212E02]/5">
        <div className="container-page max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="eyebrow !text-[#212E02]/60">Services I Sell</span>
            <h2 className="portfolio-serif text-5xl md:text-6xl text-[#212E02] mt-3">
              How I can help your brand
            </h2>
            <p className="text-sm mt-4 text-[#212E02]/70 portfolio-sans">
              I combine structural programming design systems with fine artistic transitions to design platforms that sell, convert, and engage.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {SERVICES.map((srv, idx) => {
              const IconComp = srv.icon
              return (
                <div key={idx} className="bg-[#F0EFE9]/65 hover:bg-[#F0EFE9] border border-[#212E02]/10 hover:border-[#212E02]/30 p-8 rounded-3xl transition-all duration-300 shadow-sm flex gap-6">
                  <div className="h-14 w-14 shrink-0 rounded-2xl bg-[#212E02]/5 flex items-center justify-center text-[#212E02]">
                    <IconComp size={26} />
                  </div>
                  <div>
                    <h3 className="portfolio-serif text-2xl text-[#212E02] font-semibold">{srv.title}</h3>
                    <p className="text-sm mt-3 text-[#212E02]/70 leading-relaxed portfolio-sans">{srv.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 7. Interactive Stacking Process Accordion */}
      <section id="process" className="section bg-[#F0EFE9]">
        <div className="container-page max-w-5xl">
          <div className="max-w-2xl mb-16">
            <span className="eyebrow !text-[#212E02]/60">The Building Workflow</span>
            <h2 className="portfolio-serif text-5xl md:text-6xl text-[#212E02] mt-3">
              How I build websites
            </h2>
            <p className="text-sm mt-4 text-[#212E02]/70 portfolio-sans">
              A clear, organized timeline mapping the lifecycle of your web build, ensuring transparency at every stage.
            </p>
          </div>

          <div className="flex flex-col border-t border-[#212E02]/15">
            {PROCESS_STEPS.map((step, index) => {
              const isActive = index === processActive
              return (
                <div 
                  key={step.num}
                  className={`border-b border-[#212E02]/15 py-6 transition-all duration-300 cursor-pointer ${isActive ? 'bg-[#212E02]/5 px-4 rounded-xl' : ''}`}
                  onClick={() => setProcessActive(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <span className="portfolio-serif text-3xl font-light text-[#212E02]/40">{step.num}</span>
                      <h3 className="portfolio-serif text-2xl md:text-3xl text-[#212E02] font-semibold">{step.phase}</h3>
                    </div>
                    <span className="text-[#212E02] text-sm font-semibold tracking-wider">{isActive ? '−' : '+'}</span>
                  </div>
                  
                  {isActive && (
                    <div className="mt-4 pl-12 max-w-2xl animate-[fadeIn_0.4s_ease-out]">
                      <h4 className="text-[#212E02] font-semibold text-lg portfolio-serif mb-2">{step.title}</h4>
                      <p className="text-sm text-[#212E02]/70 leading-relaxed portfolio-sans">{step.desc}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 8. Contact & Footer (Dark Forest Green) */}
      <section id="contact" className="section !pb-12 bg-[#212E02] text-[#F0EFE9]">
        <div className="container-page max-w-5xl">
          <div className="grid md:grid-cols-12 gap-12 items-start mb-20">
            
            {/* Contact text info */}
            <div className="md:col-span-5">
              <span className="eyebrow !text-[#F0EFE9]/60">Get In Touch</span>
              <h2 className="portfolio-serif text-5xl md:text-6xl text-[#F0EFE9] mt-3">
                Let's launch your next project
              </h2>
              <p className="text-sm mt-4 text-[#F0EFE9]/70 leading-relaxed portfolio-sans">
                Ready to stand out? Send me details about your website requirements, budget orient, or just say hello. I'll get back to you within 24 hours.
              </p>
              
              <div className="mt-8 space-y-4 text-sm portfolio-sans text-[#F0EFE9]/80">
                <p>📍 Available worldwide / Based in Europe</p>
                <p>✉️ anatoli@mitkov.design</p>
              </div>
            </div>

            {/* Interactive Inquiry form */}
            <div className="md:col-span-7 bg-[#F0EFE9] text-[#212E02] p-8 rounded-[2rem] shadow-xl">
              {formSubmitted ? (
                <div className="text-center py-12">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#212E02]/10 text-[#212E02] mb-4">
                    <Send size={28} />
                  </div>
                  <h3 className="portfolio-serif text-3xl font-bold">Message Sent!</h3>
                  <p className="text-sm text-[#212E02]/70 mt-2 portfolio-sans">Thank you. I'll review your project details and respond shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase text-[#212E02]/60 font-semibold mb-2">Name</label>
                      <input 
                        required
                        type="text" 
                        value={formState.name}
                        onChange={e => setFormState({...formState, name: e.target.value})}
                        placeholder="John Doe"
                        className="w-full bg-[#212E02]/5 border border-[#212E02]/15 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-[#212E02] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase text-[#212E02]/60 font-semibold mb-2">Email</label>
                      <input 
                        required
                        type="email" 
                        value={formState.email}
                        onChange={e => setFormState({...formState, email: e.target.value})}
                        placeholder="john@example.com"
                        className="w-full bg-[#212E02]/5 border border-[#212E02]/15 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-[#212E02] transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase text-[#212E02]/60 font-semibold mb-2">Budget Target (EUR)</label>
                    <select 
                      value={formState.budget}
                      onChange={e => setFormState({...formState, budget: e.target.value})}
                      className="w-full bg-[#212E02]/5 border border-[#212E02]/15 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-[#212E02] transition"
                    >
                      <option value="1500-3000">€1,500 − €3,000</option>
                      <option value="3000-6000">€3,000 − €6,000</option>
                      <option value="6000+">€6,000+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase text-[#212E02]/60 font-semibold mb-2">Project Details</label>
                    <textarea 
                      required
                      rows={4}
                      value={formState.message}
                      onChange={e => setFormState({...formState, message: e.target.value})}
                      placeholder="Describe what services you need, what goals you want to hit, and details of your website idea..."
                      className="w-full bg-[#212E02]/5 border border-[#212E02]/15 rounded-[1.5rem] p-5 text-sm focus:outline-none focus:border-[#212E02] transition resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full btn !bg-[#212E02] !text-[#F0EFE9] hover:opacity-90 font-medium py-4 text-base"
                    onMouseEnter={() => setHovering(true)}
                    onMouseLeave={() => setHovering(false)}
                  >
                    Send Inquiry & Brief
                  </button>
                </form>
              )}
            </div>

          </div>

          <div className="border-t border-[#F0EFE9]/10 pt-10 text-xs text-[#F0EFE9]/60 flex flex-col md:flex-row justify-between items-center gap-4 portfolio-sans">
            <span>© {new Date().getFullYear()} Mitkov Web Studio. All rights reserved.</span>
            <span className="flex gap-6">
              <a href="#" className="hover:text-[#F0EFE9]">GitHub</a>
              <a href="#" className="hover:text-[#F0EFE9]">LinkedIn</a>
              <a href="#" className="hover:text-[#F0EFE9]">Dribbble</a>
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}

function DecorativeShapes() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <div 
        className="portfolio-decor-circle border border-dashed border-[#212E02]/15 w-[500px] h-[500px] top-[10%] -left-[10%] animate-[spin_120s_linear_infinite]"
      />
      <div 
        className="portfolio-decor-circle border border-[#212E02]/10 w-[300px] h-[300px] bottom-[10%] -right-[5%] animate-[spin_80s_linear_infinite]"
      />
      <div 
        className="portfolio-decor-circle border border-double border-[#212E02]/5 w-[700px] h-[700px] top-[30%] right-[10%] animate-[spin_200s_linear_infinite]"
      />
    </div>
  )
}
