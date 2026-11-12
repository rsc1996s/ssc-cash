import Layout from "../components/Layout";
import CategoryManager from "../components/CategoryManager";
import PageHeader from "../components/ui/PageHeader";

export default function SettingsCategories() {
  return (
    <Layout>
      <PageHeader title="หมวดหมู่" fallbackTo="/settings" />
      <CategoryManager />
    </Layout>
  );
}
