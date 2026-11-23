'use client';

import { useParams } from 'next/navigation';
import { CourseView } from '@/components/learn/CourseView';

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  return <CourseView courseId={courseId} />;
}
