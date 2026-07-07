import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/server';
import { Product } from '@/lib/types';
import { generateMetadata as genMeta } from '@/lib/seo';

interface ProjectPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) {
    return genMeta({ title: 'Project Not Found' });
  }
  
  const { data: project } = await supabase
    .from('inspiration_projects')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!project) {
    return genMeta({ title: 'Project Not Found' });
  }

  return genMeta({
    title: project.name,
    description: project.description || `${project.name} — a project featuring Luken Lighting.`,
    path: `/inspiration/${slug}`,
  });
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) {
    notFound();
  }

  const { data: project, error: projectError } = await supabase
    .from('inspiration_projects')
    .select('*')
    .eq('slug', slug)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const [{ data: projectProducts }, { data: galleryImages }] = await Promise.all([
    supabase
      .from('project_products')
      .select('product:products(*)')
      .eq('project_id', project.id)
      .not('product_id', 'is', null),
    supabase
      .from('project_images')
      .select('*')
      .eq('project_id', project.id)
      .order('sort_order'),
  ]);

  const linkedProducts = (projectProducts || [])
    .map((pp: any) => pp.product)
    .filter(Boolean) as Product[];

  const metadata = [
    { label: 'Location', value: project.location },
    { label: 'Year', value: project.year },
    { label: 'Architectural Design', value: project.architect },
    { label: 'Lighting Design', value: project.lighting_designer },
    { label: 'Client', value: project.client_name },
    { label: 'Photography', value: project.photographer },
  ].filter(item => item.value);

  return (
    <div className="py-12 lg:py-16">
      <div className="relative h-[50vh] min-h-[400px] bg-gray-900 mb-16 flex items-center justify-center">
        {project.hero_image_url ? (
          <img
            src={project.hero_image_url}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800" />
        )}
        
        <Container className="relative z-10">
          <nav className="mb-4 text-sm text-gray-300">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/inspiration" className="hover:text-white">Inspiration</Link>
            <span className="mx-2">/</span>
            <span className="text-white">{project.name}</span>
          </nav>
          
          <h1 className="text-4xl lg:text-5xl font-light tracking-widest uppercase text-white mb-4">
            {project.name}
          </h1>
          {project.location && (
            <p className="text-lg text-gray-300 font-light">
              {project.location}
              {project.year && ` — ${project.year}`}
            </p>
          )}
        </Container>
      </div>

      <Container>
        <div className="grid lg:grid-cols-3 gap-16 mb-20">
          <div className="lg:col-span-2">
            {project.description && (
              <div className="max-w-3xl">
                <p className="text-lg text-gray-600 leading-relaxed">
                  {project.description}
                </p>
              </div>
            )}
          </div>

          {metadata.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-3">
                Project Details
              </h2>
              {metadata.map((item) => (
                <div key={item.label}>
                  <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {galleryImages && galleryImages.length > 0 && (
          <div className="mb-20">
            {/* Masonry layout: preserves each photo's natural aspect ratio so
                every image is shown in full (no cropping). */}
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-2 [column-fill:_balance]">
              {galleryImages.map((img: any) => (
                <div key={img.id} className="mb-2 break-inside-avoid bg-gray-100 overflow-hidden">
                  <img
                    src={img.image_url}
                    alt={img.caption || project.name}
                    className="block w-full h-auto"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-light tracking-wide uppercase mb-8">
            Products Used
          </h2>
          
          {linkedProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 lg:gap-12">
              {linkedProducts.map((product: Product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group block"
                >
                  <div className="space-y-3">
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      {(product.thumbnail_url || product.hero_image_url) ? (
                        <img
                          src={product.thumbnail_url || product.hero_image_url || undefined}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 group-hover:scale-105 transition-transform duration-500" />
                      )}
                    </div>
                    <h3 className="text-base font-medium text-gray-900 group-hover:text-brand-copper transition-colors">
                      {product.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500">No products linked to this project yet.</p>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
