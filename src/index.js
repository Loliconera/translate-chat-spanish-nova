const { translate, normalizeNa, AVAILABLE_LANGUAGES } = require('./translate');

module.exports = class Translator {
  constructor(mod) {
    this.mod = mod;
    this.addCommand();
    this.setupHooks();

    this.mod.game.on('leave_loading_screen', () => {
      if (mod.settings.sendMode) {
        this.mod.command.message(`Send Mode Habilitado. Traduciendo mensajes salientes a ${this.mod.settings.sendLang}.`);
        this.mod.command.message('Use "/8 translate send off" para deshabilitarlo.');
      }
    });
  }

  setupHooks() {
    const incomingMsgHandler = async (packet, version, event) => {
      if (!this.mod.settings.enabled) return;
      if (this.mod.game.me.is(event.gameId)) return;

      const translated = await this.translate(event.message, { target: this.mod.settings.targetLang, source: this.mod.settings.sourceLang });
      if (!translated) return;

      this.mod.send(packet, version, { ...event, message: `<FONT>(Traducido) ${translated}</FONT>` });
    };

    const outgoingMessageHandler = (packet, version, event) => {
      if (!this.mod.settings.enabled) return;
      if (!this.mod.settings.sendMode) return;

      (async () => {
        const translated = await this.translate(event.message, { source: 'auto', target: this.mod.settings.sendLang });
        if (!translated) return this.mod.send(packet, version, event);

        this.mod.send(packet, version, { ...event, message: `<FONT>${translated}</FONT>` });
        this.mod.command.message(`Mensaje Original: ${event.message.replace(/<(.+?)>|&rt;|&lt;|&gt;|/g, '').replace(/\s+$/, '')}`);
      })();

      return false;
    };

    const CHAT_SERVER_PACKETS = [
        ['S_CHAT', 2],
        ['S_WHISPER', 2],
        ['S_PRIVATE_CHAT', 1]
    ];
    for (const [packet, version] of CHAT_SERVER_PACKETS) this.mod.hook(packet, version, { order: 100 }, event => incomingMsgHandler(packet, version, event));
    const CHAT_CLIENT_PACKETS = [['C_WHISPER', 1], ['C_CHAT', 1]];
    for (const [packet, version] of CHAT_CLIENT_PACKETS) this.mod.hook(packet, version, {}, event => outgoingMessageHandler(packet, version, event));
  }

  async translate(message, { target, source }) {
    const sanitized = message.replace(/<(.+?)>|&rt;|&lt;|&gt;|/g, '').replace(/\s+$/, '');
    if (sanitized === '') return;

    const translated = await translate(sanitized, target, source)
      .catch(e => {
        this.mod.error(
          `Se produjo un error durante la traduccion, mensaje.:${message},`,
          `target: ${target},`,
          `source: ${source},`,
          'error: ', e);
        return '';
      });

    if (translated === sanitized) return;
    if (this.mod.publisher === 'eme') return normalizeNa(translated);
    return translated;
  }

  addCommand() {
    this.mod.command.add('translate', {
      $default: () => {
        this.mod.settings.enabled = !this.mod.settings.enabled;
        this.mod.command.message(`Modulo ${this.mod.settings.enabled ? 'Habilitado' : 'Deshabilitado'}`);
        this.mod.saveSettings();
      },
      source: language => {
        if (!language) {
          this.mod.command.message(`Idioma de Origen: ${this.mod.settings.sourceLang}.`);
          return;
        }
        if (!AVAILABLE_LANGUAGES.includes(language)) {
          this.mod.command.message(`Error: ${language} no es un idioma valido. Consulte el archivo README para los idiomas disponibles. Configuracion recomendada: Auto`);
          return;
        }
        this.mod.command.message(`Idioma de origen establecido en: ${language}.`);
        this.mod.settings.sourceLang = language;
        this.mod.saveSettings();
      },
      target: language => {
        if (!language) {
          this.mod.command.message(`Idioma de destino: ${this.mod.settings.targetLang}.`);
          return;
        }
        if (!AVAILABLE_LANGUAGES.includes(language)) {
          this.mod.command.message(`Error: ${language} no es un idioma valido. Consulte el archivo README para idiomas disponibles.`);
          return;
        }
        if (language === 'auto') {
          this.mod.command.message('ERROR: El idioma de destino no puede ser automatico.');
          return;
        }

        this.mod.command.message(`Idioma de destino establecido en: ${language}.`);
        this.mod.settings.targetLang = language;
        this.mod.saveSettings();
      },
      send: language => {
        if (language === undefined) {
          this.mod.settings.sendMode = !this.mod.settings.sendMode;
          this.mod.command.message(`Send Mode: ${this.mod.settings.sendMode ? ('Habilitado. Idioma: ' + this.mod.settings.sendLang) : 'Deshabilitado.'}`);
        } else if (AVAILABLE_LANGUAGES.includes(language)) {
          this.mod.settings.sendMode = true;
          this.mod.settings.sendLang = language;
          this.mod.command.message(`Ahora traduciendo mensajes salientes a: ${language}`);
        } else if (language === 'off') {
          this.mod.settings.sendMode = false;
          this.mod.command.message('Send Mode Desactivado.');
        } else if (language === 'on') {
          this.mod.settings.sendMode = true;
          this.mod.command.message(`Send Mode Habilitado. Ahora traduciendo mensajes salientes a ${this.mod.settings.sendLang}.`);
        } else {
          this.mod.command.message(`Error: ${language} No es un idioma valido. Consulte el archivo README para idiomas disponibles.`);
        }
        this.mod.saveSettings();
      },
    });
  }
};
