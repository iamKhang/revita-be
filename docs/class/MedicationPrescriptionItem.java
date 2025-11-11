import java.time.LocalDateTime;

public class MedicationPrescriptionItem {
    private String id;
    private String prescriptionId;
    private String name;
    private String ndc;
    private String strength;
    private String dosageForm;
    private String route;
    private Float dose;
    private String doseUnit;
    private String frequency;
    private Integer durationDays;
    private Float quantity;
    private String quantityUnit;
    private String instructions;
    private String drugId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private MedicationPrescription prescription;
    private Drug drug;
    
    public MedicationPrescriptionItem() {
    }
}

