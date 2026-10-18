// Backend API location. Production builds call the same origin (the backend serves the studio);
// `npm run dev` talks to a local backend. Override with VITE_API_BASE_URL for a separate backend.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

// Languages offered for the primary narration and for dubbed localized versions.
export const LOCALIZATION_LANGUAGES = ['English', 'Spanish', 'Hindi', 'French', 'German', 'Japanese', 'Portuguese'];

export interface PresetOption {
  value: string;
  label: string;
}

// Values are sent to Gemini as-is, so they read naturally in a prompt.
export const AUDIENCE_OPTIONS: PresetOption[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'general audience', label: 'General audience' },
  { value: 'kids (8-12 years)', label: 'Kids (8–12)' },
  { value: 'teenagers', label: 'Teenagers' },
  { value: 'students', label: 'Students' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'professionals', label: 'Professionals' },
  { value: 'experts', label: 'Experts' },
  { value: 'executives', label: 'Executives' },
];

export const TONE_OPTIONS: PresetOption[] = [
  { value: 'engaging', label: 'Engaging' },
  { value: 'informative', label: 'Informative' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'calm', label: 'Calm' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'serious', label: 'Serious' },
];

export const CREATOR_ROLE_OPTIONS: PresetOption[] = [
  { value: 'Tech & Innovation Host', label: 'Tech & Innovation Host' },
  { value: 'Educator / Teacher', label: 'Educator / Teacher' },
  { value: 'Science Communicator', label: 'Science Communicator' },
  { value: 'News Anchor', label: 'News Anchor' },
  { value: 'Business & Finance Analyst', label: 'Business & Finance Analyst' },
  { value: 'Product Reviewer', label: 'Product Reviewer' },
  { value: 'Storyteller / Narrator', label: 'Storyteller / Narrator' },
  { value: 'Motivational Speaker', label: 'Motivational Speaker' },
  { value: 'Gaming Streamer', label: 'Gaming Streamer' },
  { value: 'Travel Vlogger', label: 'Travel Vlogger' },
  { value: 'Fitness Coach', label: 'Fitness Coach' },
  { value: 'Chef / Food Creator', label: 'Chef / Food Creator' },
  { value: 'Comedian / Entertainer', label: 'Comedian / Entertainer' },
];

// YouTube categories (values match the backend's category names).
export const YOUTUBE_CATEGORY_OPTIONS: PresetOption[] = [
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'education', label: 'Education' },
  { value: 'technology', label: 'Science & Technology' },
  { value: 'news', label: 'News & Politics' },
  { value: 'howto', label: 'Howto & Style' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'music', label: 'Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'film', label: 'Film & Animation' },
  { value: 'people', label: 'People & Blogs' },
  { value: 'travel', label: 'Travel & Events' },
  { value: 'autos', label: 'Autos & Vehicles' },
  { value: 'pets', label: 'Pets & Animals' },
];

// ISO 3166-1 alpha-2 codes supported by YouTube regional trends.
export const YOUTUBE_REGION_OPTIONS: PresetOption[] = [
  { value: 'US', label: 'United States' },
  { value: 'IN', label: 'India' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'IE', label: 'Ireland' },
  { value: 'SG', label: 'Singapore' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'PH', label: 'Philippines' },
  { value: 'TH', label: 'Thailand' },
  { value: 'VN', label: 'Vietnam' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'LK', label: 'Sri Lanka' },
  { value: 'NP', label: 'Nepal' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'EG', label: 'Egypt' },
  { value: 'TR', label: 'Turkey' },
  { value: 'IL', label: 'Israel' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'KE', label: 'Kenya' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'AT', label: 'Austria' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'PL', label: 'Poland' },
  { value: 'PT', label: 'Portugal' },
  { value: 'GR', label: 'Greece' },
  { value: 'UA', label: 'Ukraine' },
  { value: 'RU', label: 'Russia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Peru' },
];
