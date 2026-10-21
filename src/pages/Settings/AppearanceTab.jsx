import { Globe } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../../contexts/ThemeContext';

export default function AppearanceTab({ language, setLanguage, timezone, setTimezone }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-ink mb-6">Theme Preferences</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-3">Color Theme</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['light', 'dark', 'auto'].map((themeOption) => (
                <label key={themeOption} className="cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value={themeOption}
                    checked={theme === themeOption}
                    onChange={(e) => setTheme(e.target.value)}
                    className="sr-only"
                  />
                  <div className={clsx(
                    'p-4 border-2 rounded-lg transition-colors',
                    theme === themeOption ? 'border-primary-500 bg-soft' : 'border-border hover:border-border'
                  )}>
                    <div className="flex items-center space-x-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-full',
                        themeOption === 'light' ? 'bg-surface border border-border' :
                        themeOption === 'dark' ? 'bg-gray-900' : ' from-white '
                      )} />
                      <span className="text-sm font-medium text-ink capitalize">{themeOption}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-ink mb-6">Language &amp; Region</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="pref-language" className="block text-sm font-medium text-ink mb-2">Language</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
              <select
                id="pref-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="en">English</option>
                <option value="ig">Igbo</option>
                <option value="ha">Hausa</option>
                <option value="yo">Yoruba</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="pref-timezone" className="block text-sm font-medium text-ink mb-2">Timezone</label>
            <select
              id="pref-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="WAT">West Africa Time (WAT)</option>
              <option value="GMT">Greenwich Mean Time (GMT)</option>
              <option value="UTC">Coordinated Universal Time (UTC)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
