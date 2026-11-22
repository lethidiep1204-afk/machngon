import coverCriticalInquiry from '../assets/images/cover_critical_inquiry_1795261545337.jpg';
import coverEthicsDebate from '../assets/images/cover_ethics_debate_1795223395652.jpg';
import coverInterdisciplinaryWorld from '../assets/images/cover_interdisciplinary_world_1795261299848.jpg';
import coverLanguageThought from '../assets/images/cover_language_thought_1795223385514.jpg';
import coverLibraryReadingHall from '../assets/images/cover_library_reading_hall_1795261276717.jpg';
import coverLiteratureCulture from '../assets/images/cover_literature_culture_1795223385935.jpg';
import coverLogicGeometry from '../assets/images/cover_logic_geometry_1795261279369.jpg';
import coverPhilosophyFreedom from '../assets/images/cover_philosophy_freedom_1795223385361.jpg';
import heroDaThu from '../assets/images/hero_da_thu_1795223388848.jpg';
import heroLucBan from '../assets/images/hero_luc_ban_1795223386407.jpg';
import heroTanBienTap from '../assets/images/hero_tan_bien_tap_1795223391644.jpg';
import heroVanHien from '../assets/images/hero_van_hien_1795223386896.jpg';

/**
 * Vite-bundled editorial artwork registry (client-only).
 * Maps persisted/seed string paths to static ES imports so assets always resolve
 * reliably in both Vite dev and production builds without modifying Node-shared data modules.
 */
export const EDITORIAL_IMAGES = {
  heroVanHien,
  heroTanBienTap,
  heroDaThu,
  heroLucBan,
  coverPhilosophyFreedom,
  coverLanguageThought,
  coverLiteratureCulture,
  coverEthicsDebate,
  coverLogicGeometry,
  coverCriticalInquiry,
  coverInterdisciplinaryWorld,
  coverLibraryReadingHall,
} as const;

export const EDITORIAL_COVER_CATALOG = [
  {
    label: 'Triết học & Hành lang đá cổ điển',
    src: '/src/assets/images/cover_philosophy_freedom_1795223385361.jpg',
  },
  {
    label: 'Ngôn ngữ & Bàn thư phòng gỗ sồi',
    src: '/src/assets/images/cover_language_thought_1795223385514.jpg',
  },
  {
    label: 'Tranh biện & Giảng đường tân cổ điển',
    src: '/src/assets/images/cover_ethics_debate_1795223395652.jpg',
  },
  {
    label: 'Văn học & Hiên tre cổ điển Việt Nam',
    src: '/src/assets/images/cover_literature_culture_1795223385935.jpg',
  },
  {
    label: 'Logic & Cân lý lẽ · Tam đoạn luận',
    src: '/src/assets/images/cover_logic_geometry_1795261279369.jpg',
  },
  {
    label: 'Tư duy phản biện & Kính lúp tra cứu',
    src: '/src/assets/images/cover_critical_inquiry_1795261545337.jpg',
  },
  {
    label: 'Liên ngành & Ban công thư viện bầu trời sao',
    src: '/src/assets/images/cover_interdisciplinary_world_1795261299848.jpg',
  },
  {
    label: 'Đại sảnh Thư viện Tri thức cổ điển',
    src: '/src/assets/images/cover_library_reading_hall_1795261276717.jpg',
  },
  {
    label: 'Thư phòng Văn Hiến ánh nắng ấm',
    src: '/src/assets/images/hero_van_hien_1795223386896.jpg',
  },
  {
    label: 'Thư viện Tinh Mộng ánh sao tím',
    src: '/src/assets/images/hero_da_thu_1795223388848.jpg',
  },
  {
    label: 'Phòng biên tập Tân Biên Tập',
    src: '/src/assets/images/hero_tan_bien_tap_1795223391644.jpg',
  },
  {
    label: 'Không gian học thuật Lục Bản',
    src: '/src/assets/images/hero_luc_ban_1795223386407.jpg',
  },
] as const;

const ASSET_PATH_MAP: Record<string, string> = {
  '/src/assets/images/hero_van_hien_1795223386896.jpg': heroVanHien,
  '/src/assets/images/hero_tan_bien_tap_1795223391644.jpg': heroTanBienTap,
  '/src/assets/images/hero_da_thu_1795223388848.jpg': heroDaThu,
  '/src/assets/images/hero_luc_ban_1795223386407.jpg': heroLucBan,
  '/src/assets/images/cover_philosophy_freedom_1795223385361.jpg': coverPhilosophyFreedom,
  '/src/assets/images/cover_language_thought_1795223385514.jpg': coverLanguageThought,
  '/src/assets/images/cover_literature_culture_1795223385935.jpg': coverLiteratureCulture,
  '/src/assets/images/cover_ethics_debate_1795223395652.jpg': coverEthicsDebate,
  '/src/assets/images/cover_logic_geometry_1795261279369.jpg': coverLogicGeometry,
  '/src/assets/images/cover_critical_inquiry_1795261545337.jpg': coverCriticalInquiry,
  '/src/assets/images/cover_interdisciplinary_world_1795261299848.jpg': coverInterdisciplinaryWorld,
  '/src/assets/images/cover_library_reading_hall_1795261276717.jpg': coverLibraryReadingHall,
};

export function resolveEditorialAsset(src: string): string {
  return ASSET_PATH_MAP[src] ?? src;
}
