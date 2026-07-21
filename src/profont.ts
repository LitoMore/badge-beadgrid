// ProFont 9pt bitmap data from https://github.com/wezm/profont (MIT).
const PROFONT_9_BASE64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAIAAIEQAAAAACAAAAAAAAAAAAAAAAAIUUceYIIIIAAAACcIccE+c+ccAACAQcAIU+qqkIQEqIAAAEi4iiMggCiiAAEAIiAIAUosoAQEcIAAAEmICCU88CiiMYI+ECAIA+cUQAQEq+AcAIqIEMkCiEciMYQACEAIAUKaqAQEIIAAAIyIIC+CiIieAAI+EIAAAAqqkAQEAIYAMQiIQiEiiIiCMYEAIAAIAAckaAIIAAYAMQc++cOccIccMYCAQIAAAAIAAAEQAAIAAgAAAAAAAAAAAIAAAAAAAAAAAAAAAAQAAgAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMQYAAcI8c8++ci+Cigiic8c8c+iiiii+IQIIAiUiiiggiiICkg2yiiiiiIiiiiiCIIIUAuUigigggiICogqqiiiigIiiiUiEIIIiAqi8gi88m+ICwgqmi8i8cIiUqIUIIEIAAu+igiggiiIiogiiigiiCIiUqUIQIEIAAgiiiiggiiIikgiiigqiiIiI2iIgICIAAei8c8+gci+ci+iicgcicIcIiiI+ICIAAAAAAAAAAAAAAAAAAACAAAAAAAAAMBYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAA/AAAAAAAAAAAAAAAAAAAAAAAAAAAEAQAAQAAAAAAAAAAAAAAAAAAAAAAAAAAIIIAAIAgACAGAgIIgYAAAAAAAIAAAAAAIIIAAAAgACAIAgAAgIAAAAAAAIAAAAAAIIIAAAe8cecce8YYkI8sc8eseciiqii+IIIaAAiiiiiIiiIIoIqyiiiygIiiqUiEQIEsAAiigi+IiiII4IqiiiigcIiUqIiIIIIAAAmigigIiiIIkIqiiiigCImUqUiQIIIAAAa8eeeIeicIicqic8eg8GaIUie+IIIAAAAAAAAACAAIAAAAAgCAAAAAAACAIIIAAAAAAAAAcAAwAAAAAgCAAAAAAAcAEAQAAAAAAAAcAAOAAAAAAAYYAAAAAYMAwwwAQAAYAAIiAASAAAAAMAEEGAeAAISAQQIAIEAkAiISU4SAAA4cSAIMMAqAAISARRZIIAIgAUIoAEOAAAEASIcEAAqAAcMA66KAUEc4i+IkAaAAAAyAMIAYAkqAAAAAEE0IUEqgcIASAieS++qAA+AAAkeMAAekKOKQiEogU+IKAaAkCAyAAIAAAkKMAAASWRWg+EoicIIkAEAkCAsAAIAAAkKAAAASuiuiiEe8iIIiA4ASAAAAA+AAA6KAcAAkCHCciAIAAAIcAAAAAAAAAAAAAgAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAYAAAAAAAAEIaUIAAQEIUQEIUAaQEIaUAAQEIUEAAAIUsAUAAIIUAIIUAAsIIUsAAAIIUAIAMIIAIIIec++++++A+ciccAccAciiAiigSEUIUUUoiggggII+ISyiiciiiiiiiii8iAUUUUiogggggIIIISqiiiiiUmiiiiiikeiiiii8g8888IIII6miiiiiIqiiiiUiki+++++ogggggIIIISiiiiiiUyiiiiI8iiiiiiioiggggIIIISiiiiiiiiiiiiIgimiiiiiuc++++++++cicccccAcccccIgsaAAAAAAIAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEIaAIAAQEIAQEIAYaQEIaAAAQEIAEAAAIUsUUAAIIUUIIUUYsIIUsUAAIIUUIgUAAAAAIAAAAAAAAAAEAAAAAAIAAAAAAgAAeeeeeccccccYYYYescccccAciiiii8iAiiiiiqiiiiiIIIIiyiiiii+miiiiiiiAiiiiiug++++IIIIiiiiiiiAqiiiiiiiAmmmmmogggggIIIIiiiiiiiIymmmmiiiAaaaaaeeeeeecccccicccccAcaaaae8eAAAAAAAIAAAAAAAAAAAAAAAAAAAAACgCAAAAAAAQAAAAAAAAAAAAAAAAAAAAAcgcA";

const SHEET_WIDTH = 32 * 6;
let fontData: Uint8Array | undefined;

function data() {
  if (!fontData) {
    const binary = window.atob(PROFONT_9_BASE64);
    fontData = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  return fontData;
}

function glyphIndex(character: string) {
  const codePoint = character.codePointAt(0) ?? 63;
  if (codePoint >= 32 && codePoint <= 126) return codePoint - 32;
  if (codePoint >= 160 && codePoint <= 255) return 95 + codePoint - 160;
  return 63 - 32;
}

export function proFontPixel(character: string, x: number, y: number) {
  const index = glyphIndex(character);
  const sheetX = (index % 32) * 6 + x;
  const sheetY = Math.floor(index / 32) * 11 + y;
  const bitIndex = sheetY * SHEET_WIDTH + sheetX;
  return (data()[bitIndex >> 3] & (1 << (7 - (bitIndex & 7)))) !== 0;
}

export const PRO_FONT = {
  width: 6,
  height: 11,
  baseline: 8,
  layoutTop: 2,
  layoutBottom: 10,
  referenceRows: 20,
} as const;
