import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { ProfileView } from '@/components/profile/ProfileView';

export default function MePage() {
  return (
    <div className="space-y-16">
      <ProfileEditor />
      <ProfileView />
    </div>
  );
}
