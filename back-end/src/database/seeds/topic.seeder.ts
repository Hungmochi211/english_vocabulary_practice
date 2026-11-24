import { DataSource } from 'typeorm';

export interface StandardTopicDef {
  code: string;
  name: string;
  nameVi: string;
  description: string;
}

export const STANDARD_TOPICS: StandardTopicDef[] = [
  // Nhóm A1–B1 (8 chủ đề) — đặt Travel & Transportation ở vị trí #2 để khớp US2-AS2 (topicId=2)
  {
    code: 'daily_life',
    name: 'Daily Life & Routines',
    nameVi: 'Đời sống & Thói quen hàng ngày',
    description: 'Các từ vựng về hoạt động sinh hoạt và thói quen mỗi ngày',
  },
  {
    code: 'travel_transport',
    name: 'Travel & Transportation',
    nameVi: 'Du lịch & Giao thông',
    description: 'Các từ vựng về phương tiện đi lại, hành trình và du lịch',
  },
  {
    code: 'people_relationships',
    name: 'People & Relationships',
    nameVi: 'Con người & Mối quan hệ',
    description: 'Các từ vựng về gia đình, bạn bè và quan hệ xã hội',
  },
  {
    code: 'education_work',
    name: 'Education & Work',
    nameVi: 'Giáo dục & Công việc',
    description: 'Các từ vựng về trường học, học tập và nghề nghiệp',
  },
  {
    code: 'food_health',
    name: 'Food & Health',
    nameVi: 'Ẩm thực & Sức khỏe',
    description: 'Các từ vựng về đồ ăn, thức uống, cơ thể và y tế',
  },
  {
    code: 'home_environment',
    name: 'Home & Environment',
    nameVi: 'Nhà cửa & Môi trường',
    description: 'Các từ vựng về không gian sống, thiên nhiên và thời tiết',
  },
  {
    code: 'entertainment_media',
    name: 'Entertainment & Media',
    nameVi: 'Giải trí & Truyền thông',
    description: 'Các từ vựng về âm nhạc, phim ảnh, thể thao và tin tức',
  },
  {
    code: 'communication_feelings',
    name: 'Communication & Feelings',
    nameVi: 'Giao tiếp & Cảm xúc',
    description: 'Các từ vựng về trò chuyện, thái độ và trạng thái tâm lý',
  },
  // Nhóm B2 (8 chủ đề)
  {
    code: 'academic_education',
    name: 'Academic & Education',
    nameVi: 'Học thuật & Giáo dục chuyên sâu',
    description: 'Các từ vựng nghiên cứu học thuật và tư duy phản biện',
  },
  {
    code: 'business_workplace',
    name: 'Business & Workplace',
    nameVi: 'Kinh doanh & Môi trường làm việc',
    description: 'Các từ vựng về quản trị, tài chính và thương mại',
  },
  {
    code: 'health_environment',
    name: 'Health & Environment',
    nameVi: 'Y tế & Môi trường sinh thái',
    description: 'Các từ vựng về sức khỏe cộng đồng và bảo tồn sinh thái',
  },
  {
    code: 'media_culture',
    name: 'Media & Culture',
    nameVi: 'Truyền thông & Văn hóa',
    description: 'Các từ vựng về nghệ thuật, báo chí và bản sắc văn hóa',
  },
  {
    code: 'personal_social_psychology',
    name: 'Personal & Social Psychology',
    nameVi: 'Tâm lý Cá nhân & Xã hội',
    description: 'Các từ vựng về hành vi, nhân cách và tâm lý học',
  },
  {
    code: 'science_technology',
    name: 'Science & Technology',
    nameVi: 'Khoa học & Công nghệ',
    description: 'Các từ vựng về kỹ thuật số, phát minh và khoa học tự nhiên',
  },
  {
    code: 'society_law',
    name: 'Society & Law',
    nameVi: 'Xã hội & Pháp luật',
    description: 'Các từ vựng về thể chế, luật pháp và vấn đề xã hội',
  },
  {
    code: 'travel_global_issues',
    name: 'Travel & Global Issues',
    nameVi: 'Du lịch & Vấn đề Toàn cầu',
    description: 'Các từ vựng về toàn cầu hóa, di cư và quan hệ quốc tế',
  },
];

export async function seedTopics(dataSource: DataSource): Promise<Map<string, { id: number; code: string; name: string; nameVi: string }>> {
  for (const t of STANDARD_TOPICS) {
    await dataSource.query(
      `
      INSERT INTO topics (code, name, name_vi, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          name_vi = EXCLUDED.name_vi,
          description = EXCLUDED.description;
      `,
      [t.code, t.name, t.nameVi, t.description],
    );
  }

  const rows: Array<{ id: number; code: string; name: string; name_vi: string }> =
    await dataSource.query(`SELECT id, code, name, name_vi FROM topics ORDER BY id ASC;`);

  const mapByName = new Map<string, { id: number; code: string; name: string; nameVi: string }>();
  for (const r of rows) {
    mapByName.set(r.name, { id: r.id, code: r.code, name: r.name, nameVi: r.name_vi });
  }
  return mapByName;
}
