const fs = require('fs');
const path = require('path');

const files = ['index.html', 'configdata.html', 'scoreboard.html', 'map-detail.html', 'login.html'];
const directory = __dirname;

const replacements = [
    { regex: /<div class="aurora-orb aurora-orb-[123]"><\/div>/g, replace: '' },
    { regex: /\bglass-card\b/g, replace: 'admin-card' },
    { regex: /\baurora-card\b/g, replace: 'admin-card' },
    { regex: /\bglass-glow-(cyan|purple)\b/g, replace: '' },
    { regex: /\bglass-effect\b/g, replace: 'admin-header' },
    { regex: /\bracing-title\b/g, replace: 'admin-title' },
    { regex: /\bracing-header\b/g, replace: 'admin-title' },
    { regex: /\bgradient-text\b/g, replace: 'text-accent' },
    { regex: /\b(digital-text|speed-text)\b/g, replace: 'data-value' },
    { regex: /\bsidebar-modern\b/g, replace: 'sidebar-admin' },
    { regex: /\bsidebar-link-modern\b/g, replace: 'sidebar-link' },
    { regex: /\b(table-cyber|speed-table)\b/g, replace: 'admin-table' },
    { regex: /\bbtn-cyber\b/g, replace: 'btn-admin' },
    { regex: /\bspeed-button\b/g, replace: 'btn-admin' },
    { regex: /\b(input-cyber|speed-input)\b/g, replace: 'input-admin' },
    { regex: /\btext-cyan-400\b/g, replace: 'text-accent' },
    { regex: /\btext-purple-400\b/g, replace: 'text-accent' },
    { regex: /\bbg-slate-900\/40\b/g, replace: 'bg-slate-800' },
    { regex: /\bborder-white\/5\b/g, replace: 'border-slate-700' },
    { regex: /\bfrom-slate-900\b/g, replace: '' },
    { regex: /\bto-slate-800\b/g, replace: '' },
    { regex: /\bbg-gradient-to-br\b/g, replace: '' }
];

files.forEach(file => {
    const filePath = path.join(directory, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        replacements.forEach(rule => {
            content = content.replace(rule.regex, rule.replace);
        });
        // cleanup multiple spaces inside class attributes
        content = content.replace(/class="([^"]+)"/g, (match, p1) => {
            return `class="${p1.replace(/\s+/g, ' ').trim()}"`;
        });
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
