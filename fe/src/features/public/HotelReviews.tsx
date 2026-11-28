import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Card, ErrorState, LoadingState } from '@/components/common'
import { PaginatedList } from '@/components/paginated-list'
import { Pagination } from '@/components/pagination'
import { PAGE_SIZE } from '@/lib/pagination'
import { errorMessage } from '@/lib/utils'
import { isMock } from '@/services'
import { api } from '@/services/api/client'
import type { Review } from '@/types/domain'

function ReviewCards({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return <p className="text-sm text-slate-500">Chưa có đánh giá được công bố.</p>
  return <div className="grid gap-3">
    {reviews.map(review => <Card key={review.id} className="p-5">
      <p className="font-semibold">{review.stars}/5 sao</p>
      <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm text-slate-600">{review.content}</p>
    </Card>)}
  </div>
}

export function HotelReviews({ hotelId, mockReviews }: { hotelId: string; mockReviews: Review[] }) {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(PAGE_SIZE)
  const reviews = useQuery({
    queryKey: ['public-reviews', hotelId, page, size],
    queryFn: () => api.publicReviewPage({ hotelId, page, limit: size, sortBy: 'createdAt', sortOrder: 'DESC' }),
    enabled: !isMock,
    placeholderData: keepPreviousData,
  })

  return <section className="mt-12" aria-label="Đánh giá khách hàng" aria-busy={!isMock && reviews.isFetching}>
    <h2 className="mb-4 text-2xl font-semibold">Đánh giá khách hàng</h2>
    {isMock ? <PaginatedList items={mockReviews} label="Phân trang đánh giá">
      {visible => <ReviewCards reviews={visible} />}
    </PaginatedList> : reviews.isPending ? <LoadingState /> : reviews.isError
      ? <ErrorState message={errorMessage(reviews.error)} retry={() => { void reviews.refetch() }} />
      : <>
        <ReviewCards reviews={reviews.data.data} />
        {reviews.data.meta.total > PAGE_SIZE && <Pagination label="Phân trang đánh giá"
          page={reviews.data.meta.page} size={reviews.data.meta.limit} total={reviews.data.meta.total}
          onPageChange={setPage} onSizeChange={value => { setSize(value); setPage(1) }} />}
      </>}
  </section>
}
