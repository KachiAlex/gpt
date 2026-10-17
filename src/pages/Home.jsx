import { useState } from 'react';
import { 
  Building, 
  Users, 
  FileText, 
  Shield,
  ArrowRight,
  CheckCircle,
  Star,
  Globe,
  Phone,
  Mail,
  Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SignInModal from '../components/Auth/SignInModal';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const [showSignInModal, setShowSignInModal] = useState(false);
  const { isAuthenticated, signIn } = useAuth();

  const stats = [
    { label: 'Active Projects', value: '324', icon: Building },
    { label: 'LGAs Covered', value: '17', icon: Globe },
    { label: 'Budget Managed', value: '₦2.4B', icon: Star },
    { label: 'Contractors', value: '45+', icon: Users }
  ];

  const features = [
    {
      title: 'Real-time Tracking',
      description: 'Monitor project progress in real-time with live updates and notifications',
      icon: CheckCircle
    },
    {
      title: 'Transparent Reporting',
      description: 'Generate comprehensive reports for stakeholders and public transparency',
      icon: FileText
    },
    {
      title: 'Multi-role Access',
      description: 'Dedicated portals for government officials, contractors, and M&E officers',
      icon: Users
    },
    {
      title: 'Secure Platform',
      description: 'Enterprise-grade security with role-based access control and data protection',
      icon: Shield
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-abia-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">GPT</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Government Project Tracker</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link to="/public" className="text-gray-700 dark:text-gray-300 hover:text-abia-600 text-sm px-3 py-2 rounded transition-colors">
                Public Portal
              </Link>
              <button
                onClick={() => setShowSignInModal(true)}
                className="bg-white hover:bg-gray-50 text-gray-900 font-semibold px-4 py-2 rounded transition-colors border border-gray-300 text-sm"
              >
                Login
              </button>
              <button className="bg-abia-600 hover:bg-abia-700 text-white font-semibold px-4 py-2 rounded transition-colors text-sm">
                Register
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Map */}
      <div className="bg-abia-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid lg:grid-cols-3 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Main Heading */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Tracking Abia Projects Together
              </h1>
              
              {/* Tagline */}
              <p className="text-xl md:text-2xl text-white/90 max-w-2xl">
                Transparency and accountability in government projects. Monitor progress, view budgets, and stay informed about development in your local government area.
              </p>
              
              {/* Search Bar */}
              <div className="relative max-w-2xl">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Search className="h-6 w-6 text-abia-600" />
                </div>
                <input
                  type="text"
                  placeholder="Find projects by name, LGA or keyword"
                  className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-abia-400"
                />
              </div>
              
              {/* Demo Navigation */}
              <div className="space-y-4">
                <p className="text-white font-semibold text-lg">Demo Navigation:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link to="/dashboard" className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-4 py-3 rounded-lg transition-colors text-center shadow-lg">
                    Admin Dashboard
                  </Link>
                  <Link to="/projects" className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-4 py-3 rounded-lg transition-colors text-center shadow-lg">
                    Projects List
                  </Link>
                  <Link to="/projects/new" className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-4 py-3 rounded-lg transition-colors text-center shadow-lg">
                    Add Project
                  </Link>
                  <Link to="/projects/PRJ-2023-001" className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-4 py-3 rounded-lg transition-colors text-center shadow-lg">
                    Project Details
                  </Link>
                </div>
              </div>
              
              {/* Explore Projects Button */}
              <div>
                <Link to="/public" className="inline-flex items-center bg-white hover:bg-gray-100 text-abia-600 font-bold px-8 py-4 rounded-lg transition-colors shadow-lg">
                  Explore Projects
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
          </div>
          
            {/* Right - Map */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-2xl p-6 border-4 border-white/20">
                <div className="relative w-full aspect-square">
                  {/* Simplified Abia State Map */}
                  <svg viewBox="0 0 300 400" className="w-full h-full">
                    {/* Background */}
                    <rect width="300" height="400" fill="#e8f5e9" />
                    
                    {/* LGAs represented as colored regions */}
                    <polygon points="150,50 200,80 180,120 100,110 80,80" fill="#ffd54f" stroke="#424242" strokeWidth="2" />
                    <text x="130" y="95" fontSize="10" fill="#000" fontWeight="bold">UMUNNEOCHI</text>
                    
                    <polygon points="100,120 200,130 190,180 90,170" fill="#ff8a65" stroke="#424242" strokeWidth="2" />
                    <text x="110" y="155" fontSize="12" fill="#000" fontWeight="bold">BENDE</text>
                    
                    <polygon points="80,180 150,185 140,240 70,235" fill="#f06292" stroke="#424242" strokeWidth="2" />
                    <text x="85" y="215" fontSize="11" fill="#000" fontWeight="bold">OHAFIA</text>
                    
                    <polygon points="70,240 140,245 130,300 60,295" fill="#4caf50" stroke="#424242" strokeWidth="2" />
                    <text x="80" y="275" fontSize="11" fill="#000" fontWeight="bold">AROCHUKWU</text>
                    
                    <polygon points="150,130 250,135 240,185 155,180" fill="#81c784" stroke="#424242" strokeWidth="2" />
                    <text x="170" y="160" fontSize="10" fill="#000" fontWeight="bold">UMUAHIA</text>
                    
                    <polygon points="155,185 230,190 220,240 160,235" fill="#64b5f6" stroke="#424242" strokeWidth="2" />
                    <text x="165" y="215" fontSize="9" fill="#000" fontWeight="bold">ABA NORTH</text>
                    
                    <polygon points="160,240 250,245 235,320 150,315" fill="#ba68c8" stroke="#424242" strokeWidth="2" />
                    <text x="180" y="285" fontSize="9" fill="#000" fontWeight="bold">UKWA WEST</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
            </div>
          </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-abia-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-8 w-8 text-abia-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{stat.value}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6">Platform Features</h2>
          <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto font-medium">
            Comprehensive tools for effective project management and monitoring
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 p-8 text-center transform hover:-translate-y-2 transition-all duration-300 cursor-pointer">
                <div className="w-16 h-16 bg-gradient-to-br from-abia-500 to-abia-700 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{feature.title}</h3>
                <p className="text-gray-700 dark:text-gray-300 text-base font-medium">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-2">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-abia-600 to-abia-800 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-extrabold text-xl">GPT</span>
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold">Government Project Tracker</h3>
                  <p className="text-gray-400 text-base font-medium">Digital Accountability Platform</p>
                </div>
              </div>
              <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                Enhancing transparency, accountability, and public trust in government project management and delivery.
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-gray-400 hover:text-white transition-colors transform hover:scale-125 duration-300">
                  <Globe className="h-6 w-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors transform hover:scale-125 duration-300">
                  <Mail className="h-6 w-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors transform hover:scale-125 duration-300">
                  <Phone className="h-6 w-6" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-xl font-extrabold mb-6">Quick Links</h4>
              <ul className="space-y-4 text-base">
                <li><Link to="/public" className="text-gray-400 hover:text-white font-medium transition-colors">Public Portal</Link></li>
                <li><Link to="/projects" className="text-gray-400 hover:text-white font-medium transition-colors">All Projects</Link></li>
                <li><Link to="/analytics" className="text-gray-400 hover:text-white font-medium transition-colors">Analytics</Link></li>
                <li><Link to="/reports" className="text-gray-400 hover:text-white font-medium transition-colors">Reports</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xl font-extrabold mb-6">Contact</h4>
              <div className="space-y-3 text-base text-gray-300 font-medium">
                <p>Government Project Office</p>
                <p>Government Secretariat</p>
                <p>Phone: +234 800 GOV HEL</p>
                <p>Email: info@gpt-system.gov</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-base text-gray-400 font-medium">
              © 2025 Government Project Tracker. All rights reserved. | Powered by Kreatix Technologies
            </p>
          </div>
        </div>
      </footer>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        onSignIn={signIn}
      />
    </div>
  );
}
