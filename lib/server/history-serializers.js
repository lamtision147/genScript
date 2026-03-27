export function normalizeHistoryRecord(item) {
  return {
    id: item.id,
    createdAt: item.created_at || item.createdAt,
    userId: item.user_id || item.userId || null,
    title: item.title || null,
    variantLabel: item.variant_label || item.variantLabel || null,
    form: item.form_data || item.form || {},
    images: item.form_data?.images || item.images || [],
    result: item.result_data || item.result || {}
  };
}

export function createSupabaseHistoryInsert({ userId, title, variantLabel, formData, resultData, images = [] }) {
  return {
    user_id: userId,
    title,
    variant_label: variantLabel,
    form_data: { ...formData, images },
    result_data: resultData
  };
}
