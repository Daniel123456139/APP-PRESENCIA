/**
 * Servicio de Firebase Storage para Fotos de Perfil
 * 
 * GDPR COMPLIANCE:
 * - NO guarda URLs en colección EMPLEADOS
 * - Las URLs se obtienen dinámicamente por employeeId
 * - Organización: /profile-photos/{employeeId}.jpg
 * 
 * @module storageService
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { getFirebaseStorage } from '../firebaseConfig';
import logger from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════

const PROFILE_PHOTOS_PATH = 'profile-photos';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════

/**
 * Subir foto de perfil de un empleado
 * La foto se redimensiona automáticamente en el cliente
 */
export async function uploadProfilePhoto(
    employeeId: string | number,
    file: File
): Promise<string> {
    try {
        // Validaciones
        if (!file) throw new Error('No se proporcionó archivo');
        if (file.size > MAX_FILE_SIZE) throw new Error('El archivo es demasiado grande (máx 2MB)');
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Formato no permitido. Use JPEG, PNG o WebP');
        }

        const storage = getFirebaseStorage();
        const normalizedId = employeeId.toString().padStart(3, '0');

        // Ruta: /profile-photos/049.jpg
        const photoRef = ref(storage, `${PROFILE_PHOTOS_PATH}/${normalizedId}.jpg`);

        // Subir archivo
        const snapshot = await uploadBytes(photoRef, file, {
            contentType: 'image/jpeg',
            cacheControl: 'public,max-age=3600'
        });

        // Obtener URL de descarga
        const downloadURL = await getDownloadURL(snapshot.ref);

        logger.success(`✅ Foto de perfil subida para empleado ${normalizedId}`);
        return downloadURL;
    } catch (error) {
        logger.error('❌ Error subiendo foto de perfil:', error);
        throw error;
    }
}

/**
 * Obtener URL de foto de perfil de un empleado
 * Retorna null si no tiene foto
 */
export async function getProfilePhotoURL(
    employeeId: string | number
): Promise<string | null> {
    try {
        const storage = getFirebaseStorage();
        const normalizedId = employeeId.toString().padStart(3, '0');

        const photoRef = ref(storage, `${PROFILE_PHOTOS_PATH}/${normalizedId}.jpg`);

        // Intentar obtener URL
        const url = await getDownloadURL(photoRef);
        return url;
    } catch (error: any) {
        // Si no existe la foto, retorna null (no es error)
        if (error.code === 'storage/object-not-found') {
            return null;
        }
        logger.error('❌ Error obteniendo foto de perfil:', error);
        return null;
    }
}

/**
 * Eliminar foto de perfil de un empleado
 */
export async function deleteProfilePhoto(
    employeeId: string | number
): Promise<void> {
    try {
        const storage = getFirebaseStorage();
        const normalizedId = employeeId.toString().padStart(3, '0');

        const photoRef = ref(storage, `${PROFILE_PHOTOS_PATH}/${normalizedId}.jpg`);

        await deleteObject(photoRef);
        logger.success(`✅ Foto de perfil eliminada para empleado ${normalizedId}`);
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            logger.warn(`⚠️ No se encontró foto para eliminar (empleado ${employeeId})`);
            return;
        }
        logger.error('❌ Error eliminando foto de perfil:', error);
        throw error;
    }
}

/**
 * Redimensionar imagen en el cliente antes de subir
 * Retorna un nuevo File redimensionado
 */
export async function resizeImage(
    file: File,
    maxWidth: number = 200,
    maxHeight: number = 200,
    quality: number = 0.8
): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calcular nuevas dimensiones manteniendo aspecto
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('No se pudo obtener contexto de canvas'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Convertir canvas a blob y luego a File
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Error al convertir imagen'));
                            return;
                        }

                        const resizedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });

                        resolve(resizedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => reject(new Error('Error cargando imagen'));
            img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsDataURL(file);
    });
}

/**
 * Obtener lista de todos los empleados con foto
 * Útil para estadísticas
 */
export async function listEmployeesWithPhoto(): Promise<string[]> {
    try {
        const storage = getFirebaseStorage();
        const photosRef = ref(storage, PROFILE_PHOTOS_PATH);

        const result = await listAll(photosRef);

        const employeeIds = result.items.map(itemRef => {
            // Extraer ID del nombre del archivo (ej: "049.jpg" -> "049")
            const filename = itemRef.name;
            return filename.replace('.jpg', '');
        });

        return employeeIds;
    } catch (error) {
        logger.error('❌ Error listando fotos de perfil:', error);
        return [];
    }
}
