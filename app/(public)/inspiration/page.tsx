import Link from 'next/link';
import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/server';
import { InspirationProject } from '@/lib/types';
import { generateMetadata as genMeta } from '@/lib/seo';

export const metadata = genMeta({
  title: 'Inspiration',
  description: 'Explore projects where our architectural lighting brings spaces to life — invisibly.',
  path: '/inspiration',
});

export default async function InspirationPage() {
  const supabase = await createClient();

  const { data: projects } = supabase
    ? await supabase
        .from('inspiration_projects')
        .select('*')
        .order('sort_order')
    : { data: null };

  return (
    <div className="py-12 lg:py-16">
      <Container>
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl lg:text-5xl font-light tracking-widest uppercase mb-4">
            Inspiration
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover how our architectural lighting transforms spaces — letting the architecture speak while the fixtures disappear
          </p>
        </div>

        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          {projects?.map((project: InspirationProject) => (
            <Link
              key={project.id}
              href={`/inspiration/${project.slug}`}
              className="group"
            >
              <div className="space-y-4">
                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                  {(project.thumbnail_url || project.hero_image_url) ? (
                    <Image
                      src={project.thumbnail_url || project.hero_image_url!}
                      alt={project.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 group-hover:scale-105 transition-transform duration-500" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-light tracking-wide uppercase mb-2 group-hover:text-brand-copper transition-colors">
                    {project.name}
                  </h2>
                  {project.location && (
                    <p className="text-sm text-gray-500 mb-1">
                      {project.location}
                      {project.year && ` — ${project.year}`}
                    </p>
                  )}
                  {project.architect && (
                    <p className="text-xs text-gray-400">
                      {project.architect}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {(!projects || projects.length === 0) && (
          <div className="text-center py-16">
            <p className="text-gray-500">No projects available at this time.</p>
          </div>
        )}
      </Container>
    </div>
  );
}
