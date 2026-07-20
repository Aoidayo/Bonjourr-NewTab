import { compressAsDataUri, svgToText } from '../../shared/compress.ts'
import { storage } from '../../storage.ts'

import type { AutoIconCache } from '../../../types/local.ts'

async function convertIconFileToDataUri(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
        throw new Error('Icon file must be an image')
    }

    const isSmall = file.size < 16000
    const type = file.type.replace('image/', '')

    if (isSmall) {
        if (type.includes('svg')) {
            const data = await svgToText(file)
            return `data:image/svg+xml;base64,${btoa(data)}`
        }
        if (type.includes('png')) {
            return await compressAsDataUri(file, {
                square: true,
                type: 'png',
                q: 1.0,
            })
        }
    }

    return await compressAsDataUri(file, {
        type: type.includes('png') ? 'png' : 'jpeg',
        square: true,
        size: 144,
        q: .8,
    })
}

export async function storeIconFile(id: string, file: File): Promise<string> {
    const uri = await convertIconFileToDataUri(file)

    storage.local.set({ [`x-icon-${id}`]: uri })

    return uri
}

export async function cacheAutoIcon(id: string, source: string): Promise<AutoIconCache> {
    const key = `x-auto-icon-${id}` as const

    try {
        const response = await fetch(source, { cache: 'force-cache' })

        if (!response.ok) {
            throw new Error(`Icon request failed with ${response.status}`)
        }

        const blob = await response.blob()

        if (!blob.type.startsWith('image/')) {
            throw new Error(`Icon response is not an image: ${blob.type}`)
        }

        const data = await blobToDataUri(blob)
        const cached = { source, data }
        storage.local.set({ [key]: cached })
        return cached
    } catch (_) {
        const cached: AutoIconCache = { source, failed: true }
        storage.local.set({ [key]: cached })
        return cached
    }
}

function blobToDataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.addEventListener('load', () => resolve(reader.result?.toString() ?? ''))
        reader.addEventListener('error', () => reject(reader.error))
        reader.readAsDataURL(blob)
    })
}
