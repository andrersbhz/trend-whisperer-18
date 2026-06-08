import { Link } from 'react-router-dom';

export interface BlogCategory {
  id: string;
  label: string;
}

interface BlogCategoryNavProps {
  categories: BlogCategory[];
  currentLang: string;
  limit?: number;
  className?: string;
  itemClassName?: string;
  withBrand?: boolean;
}

const BlogCategoryNav = ({
  categories,
  currentLang,
  limit,
  className = '',
  itemClassName = 'hover:opacity-70 transition-opacity text-[#444] hover:text-primary',
  withBrand = false,
}: BlogCategoryNavProps) => {
  const items = limit ? categories.slice(0, limit) : categories;
  return (
    <div className={className}>
      {withBrand && <span className="text-[#000] font-black mr-2">A3 BLOG</span>}
      {items.map((cat) => (
        <Link key={cat.id} to={`/${currentLang}/category/${cat.id}`} className={itemClassName}>
          {cat.label}
        </Link>
      ))}
    </div>
  );
};

export default BlogCategoryNav;
