'use strict';
const { shell } = require('electron');

const EXTERNAL_PROTOCOLS = [
    'roblox:', 'roblox-player:', 'discord:', 'spotify:', 'steam:', 'tg:', 'whatsapp:', 'zoommtg:'
];

function isExternalProtocol(url) {
    if (typeof url !== 'string') return false;
    return EXTERNAL_PROTOCOLS.some(p => url.toLowerCase().startsWith(p));
}

function hook(wc) {
    // 1. Intercetar quando a página tenta navegar para uma app externa
    wc.on('will-navigate', (e, url) => {
        if (isExternalProtocol(url)) {
            e.preventDefault();
            shell.openExternal(url).catch(err => console.error('Erro ao abrir app externa:', err));
        }
    });

    // 2. Intercetar quando um link é clicado e tenta abrir numa nova janela
    wc.setWindowOpenHandler(({ url }) => {
        if (isExternalProtocol(url)) {
            shell.openExternal(url).catch(err => console.error('Erro ao abrir app externa:', err));
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

module.exports = { hook };
