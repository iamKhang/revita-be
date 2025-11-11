import java.util.List;
import java.util.Map;

public class Drug {
    private String id;
    private String name;
    private String ndc;
    private String strength;
    private String dosageForm;
    private String route;
    private String unit;
    private Map<String, Object> source;
    
    // Quan hệ một-nhiều
    private List<MedicationPrescriptionItem> items;
    
    public Drug() {
    }
}

