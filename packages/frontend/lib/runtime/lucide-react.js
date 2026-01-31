/**
 * Lucide React ESM Bridge
 * Resolves naming differences and prevents crashes.
 */
const p = (n) => (props) => {
  const aliasMap = { 
    'DollarSign': 'CircleDollarSign', 
    'HelpCircle': 'CircleHelp',
    'BarChart3': 'BarChart'
  };
  
  const target = aliasMap[n] || n;
  const C = (window.FrameworkIcons && window.FrameworkIcons[target]) || 
            (window.Lucide && window.Lucide[target]) ||
            (window.Fromcode && window.Fromcode[target]);
  
  if (!C) {
    console.warn(`Icon "${n}" not found. Ensure the icon pack is loaded.`);
    return null; 
  }
  
  return window.React.createElement(C, props);
};

// The proxy allows us to export any icon name dynamically
export default new Proxy({}, {
  get: (_, name) => p(name)
});
