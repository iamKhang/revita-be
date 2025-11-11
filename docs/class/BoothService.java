public class BoothService {
    private String boothId;
    private String serviceId;
    private boolean isActive;
    
    // Quan hệ nhiều-một
    private Booth booth;
    private Service service;
    
    public BoothService() {
    }
}

