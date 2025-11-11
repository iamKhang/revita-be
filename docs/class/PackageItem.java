public class PackageItem {
    private String id;
    private String packageId;
    private String serviceId;
    private int quantity;
    private Float priceOverride;
    private boolean required;
    private Integer sortOrder;
    private String notes;
    
    // Quan hệ nhiều-một
    private Package package_;
    private Service service;
    
    public PackageItem() {
    }
}

