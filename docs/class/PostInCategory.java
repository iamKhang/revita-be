public class PostInCategory {
    private String postId;
    private String categoryId;
    
    // Quan hệ nhiều-một
    private Post post;
    private PostCategory category;
    
    public PostInCategory() {
    }
}

