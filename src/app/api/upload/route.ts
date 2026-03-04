import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API - Request received')
    await connectToDatabase()
    const user = await getCurrentUser()
    
    if (!user) {
      console.log('Upload API - Unauthorized')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Upload API - User:', user.id)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    console.log('Upload API - File:', file ? 'Yes' : 'No', 'Type:', file?.type, 'Size:', file?.size)
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64String = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64String}`
    
    console.log('Image uploaded:', file.name, 'Size:', file.size, 'Data URL length:', dataUrl.length)

    return NextResponse.json({
      image_url: dataUrl
    })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
