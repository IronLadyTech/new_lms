import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

function ext(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export async function uploadFile(file, folder) {
  if (!storage) throw new Error('Firebase Storage is not configured.');
  if (!file) throw new Error('No file selected.');

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const path = `${folder}/${safeName}`;
  const fileRef = ref(storage, path);

  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, path, fileName: file.name, extension: ext(file.name) };
}

export async function uploadResourceFile(file) {
  return uploadFile(file, 'resources');
}

export async function uploadCourseAsset(file) {
  return uploadFile(file, 'courses');
}

export async function uploadEventImage(file) {
  return uploadFile(file, 'events');
}

export const ACCEPTED_RESOURCE_TYPES = {
  pdf: ['.pdf', 'application/pdf'],
  ppt: ['.ppt', '.pptx', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  video: [],
};

export function resourceTypeFromFile(file) {
  const e = ext(file.name);
  if (e === '.pdf') return 'pdf';
  if (e === '.ppt' || e === '.pptx') return 'ppt';
  return 'pdf';
}
