'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, ChevronRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createProject,
  deleteProject,
  updateProjectSortOrder,
} from '@/app/(admin)/admin/inspiration/actions';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { InspirationProject } from '@/lib/types';

interface Props {
  initialProjects: InspirationProject[];
}

function SortableProjectCard({
  project,
  onDelete,
}: {
  project: InspirationProject;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 bg-white flex items-center hover:bg-gray-50 transition-colors group">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-4 text-gray-400 hover:text-gray-600 touch-none self-stretch flex items-center"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Link
        href={`/admin/inspiration/${project.id}`}
        className="flex-1 p-4 pl-0 flex items-center justify-between min-w-0"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {project.thumbnail_url ? (
            <img src={project.thumbnail_url} alt={project.name} className="w-12 h-12 object-cover flex-shrink-0 border border-gray-200" />
          ) : (
            <div className="w-12 h-12 bg-gray-100 flex-shrink-0 border border-gray-200" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{project.name}</span>
              <span className="text-xs text-gray-400">{project.slug}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
              {project.location && <span>{project.location}</span>}
              {project.year && <span>{project.year}</span>}
              {project.architect && <span>{project.architect}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </Link>
    </div>
  );
}

export function InspirationManager({ initialProjects }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newArchitect, setNewArchitect] = useState('');
  const [newLightingDesigner, setNewLightingDesigner] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newPhotographer, setNewPhotographer] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');

    const fd = new FormData();
    fd.set('name', newName.trim());
    fd.set('description', newDescription.trim());
    fd.set('location', newLocation.trim());
    fd.set('year', newYear.trim());
    fd.set('architect', newArchitect.trim());
    fd.set('lighting_designer', newLightingDesigner.trim());
    fd.set('client_name', newClientName.trim());
    fd.set('photographer', newPhotographer.trim());

    const result = await createProject(fd);
    if (result.error) {
      setError(result.error);
    } else if (result.project) {
      setProjects((prev) => [...prev, result.project as InspirationProject]);
      resetCreateForm();
    }
    setSaving(false);
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewDescription('');
    setNewLocation('');
    setNewYear('');
    setNewArchitect('');
    setNewLightingDesigner('');
    setNewClientName('');
    setNewPhotographer('');
    setShowCreate(false);
  };

  const handleDelete = async (e: React.MouseEvent, project: InspirationProject) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Delete project',
      message: `Delete project "${project.name}"? This will also remove all its images and product links.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const result = await deleteProject(project.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(`Project "${project.name}" deleted.`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(projects, oldIndex, newIndex);
    setProjects(reordered);
    await updateProjectSortOrder(reordered.map((p) => p.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Inspiration Projects</h1>
          <p className="text-gray-600">Manage project showcases</p>
        </div>
        {!showCreate && (
          <Button type="button" variant="primary" onClick={() => { setShowCreate(true); setError(''); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Project
          </Button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>}

      {showCreate && (
        <div className="bg-green-50 border border-green-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider">New Project</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name *" className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" autoFocus />
            <input type="text" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Location (e.g. Madrid, Spain)" className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            <input type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="Year (e.g. 2024)" className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            <input type="text" value={newArchitect} onChange={(e) => setNewArchitect(e.target.value)} placeholder="Architect" className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            <input type="text" value={newLightingDesigner} onChange={(e) => setNewLightingDesigner(e.target.value)} placeholder="Lighting Designer" className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Client" className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            <input type="text" value={newPhotographer} onChange={(e) => setNewPhotographer(e.target.value)} placeholder="Photographer" className="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Project description" rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !newName.trim()} className="px-4 py-2 text-sm bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors">Create Project</button>
            <button onClick={resetCreateForm} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {projects.map((project) => (
              <SortableProjectCard
                key={project.id}
                project={project}
                onDelete={(e) => handleDelete(e, project)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {projects.length === 0 && !showCreate && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm border border-gray-200">
            No projects yet. Create your first one.
          </div>
        )}
      </div>
    </div>
  );
}
