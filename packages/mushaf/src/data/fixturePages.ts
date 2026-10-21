import type { MushafLine, MushafPageData, MushafWord } from '../types'

function words(surah: number, ayah: number, texts: string[], startIndex = 1): MushafWord[] {
  return texts.map((text, offset) => {
    const wordIndex = startIndex + offset
    return { id: `${surah}:${ayah}:${wordIndex}`, surah, ayah, wordIndex, text }
  })
}

function line(lineNumber: number, ...groups: MushafWord[][]): MushafLine {
  return { lineNumber, words: groups.flat() }
}

// Fixture: Al-Fatiha only (page 1). Line breaks are illustrative, not the
// authoritative Madinah layout -- replace with the QUL dataset behind
// `getMushafPage` when it's sourced.
export const FIXTURE_PAGES: Record<number, MushafPageData> = {
  1: {
    page: 1,
    lines: [
      line(1, words(1, 1, ['بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَٰنِ', 'ٱلرَّحِيمِ'])),
      line(2, words(1, 2, ['ٱلْحَمْدُ', 'لِلَّهِ', 'رَبِّ', 'ٱلْعَٰلَمِينَ'])),
      line(3, words(1, 3, ['ٱلرَّحْمَٰنِ', 'ٱلرَّحِيمِ']), words(1, 4, ['مَٰلِكِ', 'يَوْمِ', 'ٱلدِّينِ'])),
      line(4, words(1, 5, ['إِيَّاكَ', 'نَعْبُدُ', 'وَإِيَّاكَ', 'نَسْتَعِينُ'])),
      line(5, words(1, 6, ['ٱهْدِنَا', 'ٱلصِّرَٰطَ', 'ٱلْمُسْتَقِيمَ'])),
      line(6, words(1, 7, ['صِرَٰطَ', 'ٱلَّذِينَ', 'أَنْعَمْتَ', 'عَلَيْهِمْ'])),
      line(7, words(1, 7, ['غَيْرِ', 'ٱلْمَغْضُوبِ', 'عَلَيْهِمْ', 'وَلَا', 'ٱلضَّآلِّينَ'], 5)),
    ],
  },
}
