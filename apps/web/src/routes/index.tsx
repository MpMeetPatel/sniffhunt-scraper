import { createFileRoute } from '@tanstack/react-router';
import { ScrapingInterface } from '../components/scraping-interface';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="container mx-auto max-w-[90%] px-4 py-6">
      <ScrapingInterface />
    </div>
  );
}
