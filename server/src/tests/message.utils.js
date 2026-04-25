function previewText(content, max = 120) {
    if (!content) return '';
    const t = String(content).trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

module.exports = { previewText };