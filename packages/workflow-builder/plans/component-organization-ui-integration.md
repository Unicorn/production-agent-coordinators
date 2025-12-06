# Component Organization UI Integration

**Date:** 2025-01-XX  
**Status:** Ready to Implement  
**Prerequisites:** ✅ All migrations completed successfully

---

## What's Been Completed

✅ **Database Schema**
- Component categories table (hierarchical structure)
- Component category mappings
- Component keywords for AI search
- Component use cases
- All components seeded with categories

✅ **Migrations**
- All 48 migrations optimized and idempotent
- Dependencies handled gracefully
- All components mapped to new categories

---

## What's Left: UI Integration

### 1. Create API Endpoints for Categories

**File:** `src/server/api/routers/components.ts` (or new `categories.ts` router)

**Endpoints needed:**
- `getCategories` - Fetch all categories with hierarchy
- `getCategoryTree` - Get full category tree structure
- `getComponentsByCategory` - Get components grouped by category

**Update `components.list` query to include:**
- Category mappings
- Keywords
- Use cases

### 2. Update Component Queries

**File:** `src/server/api/routers/components.ts`

**Changes:**
- Add category joins to component queries
- Include `component_category_mapping` in SELECT
- Include `component_keywords` for search
- Filter by category in list query

### 3. Update UI Components

**Files to update:**

#### `src/components/workflow-builder/NodeTypesPalette.tsx`
- Replace hardcoded `categories` array
- Fetch categories from API
- Use hierarchical category structure
- Display parent/child categories

#### `src/components/workflow/ComponentPalette.tsx`
- Replace `UTILITY_CATEGORIES` import
- Fetch categories from database
- Use `categorizeComponent` based on database mappings
- Support hierarchical display

#### `src/components/component/ComponentList.tsx`
- Replace `UTILITY_CATEGORIES` import
- Fetch categories from database
- Group by database categories
- Support category filtering

#### `src/lib/component-categorization.ts`
- **Option A:** Update to fetch from database
- **Option B:** Keep as fallback, but prefer database categories
- Add function to get category from database mapping

### 4. Create Category Display Components

**New files:**
- `src/components/category/CategoryTree.tsx` - Hierarchical category display
- `src/components/category/CategorySelector.tsx` - Category filter/selector
- `src/hooks/useComponentCategories.ts` - Hook for fetching categories

---

## Implementation Plan

### Phase 1: API Layer
1. Create `categories` router or add to `components` router
2. Add category endpoints
3. Update component queries to include categories
4. Test API endpoints

### Phase 2: Data Layer
1. Update `component-categorization.ts` to use database
2. Create hooks for category fetching
3. Update type definitions

### Phase 3: UI Components
1. Update `NodeTypesPalette.tsx`
2. Update `ComponentPalette.tsx`
3. Update `ComponentList.tsx`
4. Add hierarchical category display

### Phase 4: Testing
1. Test category display in React Flow
2. Test category display in components page
3. Test search with keywords
4. Test filtering by category

---

## Key Considerations

### Backward Compatibility
- Keep old categorization working during transition
- Support both database and hardcoded categories
- Graceful fallback if database categories unavailable

### Performance
- Cache categories (they don't change often)
- Use React Query for category data
- Lazy load category trees

### User Experience
- Smooth transition from old to new categories
- Clear visual hierarchy
- Search works with keywords
- Filtering by category works

---

## Database Schema Reference

```sql
-- Categories (hierarchical)
component_categories (
  id, name, display_name, description, 
  parent_id, level, sort_order
)

-- Component to category mappings
component_category_mapping (
  component_id, category_id, is_primary
)

-- Keywords for AI search
component_keywords (
  component_id, keyword, relevance_score
)

-- Use cases
component_use_cases (
  component_id, use_case, description
)
```

---

## Next Steps

1. **Create API endpoints** for categories
2. **Update component queries** to include category data
3. **Update UI components** to use database categories
4. **Test** the complete flow
5. **Remove** old hardcoded categories once migration complete

---

## Files to Create/Update

### New Files
- `src/server/api/routers/categories.ts` (or add to components.ts)
- `src/components/category/CategoryTree.tsx`
- `src/hooks/useComponentCategories.ts`

### Files to Update
- `src/server/api/routers/components.ts` - Add category joins
- `src/components/workflow-builder/NodeTypesPalette.tsx` - Use DB categories
- `src/components/workflow/ComponentPalette.tsx` - Use DB categories
- `src/components/component/ComponentList.tsx` - Use DB categories
- `src/lib/component-categorization.ts` - Add DB support

---

## Testing Checklist

- [ ] Categories load from database
- [ ] Hierarchical structure displays correctly
- [ ] Components grouped by category
- [ ] Search works with keywords
- [ ] Filtering by category works
- [ ] React Flow palette uses categories
- [ ] Components page uses categories
- [ ] Both UIs use same logic
- [ ] Performance is acceptable
- [ ] Fallback works if DB unavailable

