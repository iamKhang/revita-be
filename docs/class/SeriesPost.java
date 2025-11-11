public class SeriesPost {
    private String seriesId;
    private String postId;
    private int order;
    
    // Quan hệ nhiều-một
    private Series series;
    private Post post;
    
    public SeriesPost() {
    }
}

